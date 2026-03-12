# Nexly Group - Backend Event Processing Challenge

Serviço de alta performance desenvolvido para ingestão, persistência e processamento assíncrono de eventos, garantindo **idempotência**, **resiliência** e **observabilidade**.

O projeto resolve desafios de sistemas distribuídos como processamento de grande volumetria, falhas em integrações externas e garantia de processamento único (deduplicação).

---

## Diferenciais Implementados

Além dos requisitos obrigatórios, este projeto inclui:

* **Rate Limiting:** Proteção contra ataques de força bruta/DDoS (limite de requisições por IP).
* **Dead Letter Queue (DLQ):** Mensagens do Kafka que falham no processamento não são perdidas, garantindo observabilidade.
* **Deadlock Prevention:** Ordenação determinística de recursos antes do travamento no banco.
* **Idempotência e Autorrecuperação:** Garantia via Redis e Database de que um evento nunca seja processado mais de uma vez. O sistema detecta automaticamente eventos que falharam no envio inicial e permite a re-tentativa de despacho para o Broker sem duplicar registros.
* **Swagger/OpenAPI:** Documentação automática da API.
* **Testes E2E:** Validação de fluxos completos de ponta a ponta.

---

## Arquitetura e Decisões Técnicas

O sistema adota uma **Arquitetura Híbrida em Camadas**, permitindo que a mesma instância atue como API HTTP de alta performance e como Worker de processamento assíncrono (Consumer).

| Tecnologia | Função | Justificativa |
| :--- | :--- | :--- |
| **NestJS + Fastify** | Backend Framework | Uso do **Fastify** em vez do Express para garantir o menor overhead possível e máxima vazão de requisições por segundo. |
| **Arquitetura Modular** | Estrutura de Código | Organização em módulos encapsulados (Events, Messaging, Cache), facilitando a manutenção e escalabilidade. |
| **PostgreSQL** | Banco de Dados | Transações ACID e suporte a **Pessimistic Locking** (`SELECT ... FOR UPDATE`), essencial para evitar condições de corrida (Race Conditions). |
| **Redis** | Cache Distribuído | Implementação de *Cache-Aside* para idempotência instantânea, reduzindo latência e IO de banco de dados. |
| **Apache Kafka** | Mensageria | Processamento assíncrono resiliente, garantindo o desacoplamento entre a recepção do evento e sua integração externa. |
| **Docker** | Infraestrutura | Padronização do ambiente e orquestração de serviços complexos (Kafka, DB, Redis) em um único comando. |

---

## Diferenciais da Implantação

### 1. Exponential Backoff (Retentativa Inteligente)
**Cenário:** Integrações externas instáveis podem falhar.
**Solução:** Implementado atraso de recuo exponencial garantindo que a carga do ecossistema não seja afetada, com saltos de 2s, 4s, 8s, 16s e 32s.

### 2. Dead Letter Queue (DLQ)
**Cenário:** O evento não deve travar toda a fila do Kafka, mas também não pode sumir.
**Solução:** Após o limite de retentativas (5), enviamos o evento a um tópico `events.dlq` exclusivo, registrando o problema para análise separada.

### 3. Idempotência em Duas Camadas
*   **Na Ingestão:** Bloqueio instantâneo via Redis SET NX para evitar múltiplas gravações do mesmo `event_id`.
*   **No Processamento (Worker):** Trava de exclusão mútua distribuída (`PROCESSING lock`). Isso garante que, mesmo em cenários de reequilíbrio de partições do Kafka, apenas um worker execute a integração externa por vez (evitando Race Conditions).

---

## Como Executar

### Pré-requisitos
* Docker e Docker Compose instalados.

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/IsabelleBrandao/backend-event-processing-challenge.git
    cd backend-event-processing-challenge
    ```

2.  **Suba o ambiente:**
    ```bash
    docker-compose up --build
    ```

3.  **Aguarde a inicialização:**
    O sistema estará pronto quando a API conectar aos Brokers.
    *   **API:** `http://localhost:3000`
    *   **Swagger:** `http://localhost:3000/api`

---

## Guia de Validação do Desafio

Para facilitar a avaliação da robustez do sistema, siga este roteiro de testes:

### 1. Inicialização do Ambiente
Certifique-se de que os containers estão rodando conforme as instruções na seção "Como Executar".
Aguarde até visualizar no log da API a mensagem: `[KafkaConsumerController] [WORKER] Consumer has joined the group`.

### 2. Fluxo Feliz (Ingestão e Processamento)
1.  Acesse o Swagger em: `http://localhost:3000/api`.
2.  No endpoint `POST /events`, utilize o payload de exemplo disponível na documentação ou copie o JSON abaixo.
3.  Clique em **Execute**. A resposta deve ser `202 Accepted`.
4.  Observe os logs do terminal: você verá o evento sendo persistido e, logo em seguida, o Worker processando-o com sucesso.

### 3. Validação de Idempotência
1.  Com o mesmo `event_id` do passo anterior, clique em **Execute** novamente.
2.  A resposta continuará sendo `202 Accepted` para o cliente (mantendo a consistência da interface), mas nos logs da API você verá o aviso: `[API] Evento duplicado ignorado (Cache)`.
3.  Isso valida que o sistema não reprocessa eventos idênticos, economizando recursos de infraestrutura.

### 4. Teste de Carga e Resiliência (Volume)
O script de volumetria simula o envio massivo de eventos, incluindo falhas sintéticas para validar a DLQ.
1.  Em um terminal separado, execute:
    ```bash
    npm run generate-events -- --count 500
    ```
2.  Observe a API aceitando as requisições em alta velocidade enquanto o Worker processa as mensagens de forma assíncrona em background.

> **Nota Técnica:** O script está configurado para injetar **2% de falhas sintéticas** (Fault Injection). Portanto, ao final de um teste de 500 eventos, é esperado que aproximadamente **10 eventos** terminem com status `DLQ`, permitindo a validação completa do circuito de erro e dos endpoints de auditoria.

### 5. Observabilidade e Métricas
Após o término do script de carga, acesse os endpoints de monitoramento:
*   **Métricas de Status:** `http://localhost:3000/events/metrics`
    *   Verifique o agrupamento por status (`PROCESSED`, `DLQ`).
*   **Auditoria de DLQ:** `http://localhost:3000/events/dlq`
    *   Visualize os eventos que excederam as 5 tentativas de processamento (injetados propositalmente pelo script para validação do circuito de erro).

---

---

## Production Readiness e Melhorias Futuras

Este projeto foi desenvolvido com foco em alta escalabilidade, mas para um ambiente de produção real, as seguintes práticas seriam adotadas:

1. **Schema Migrations:** O uso de `synchronize: true` no TypeORM foi utilizado para agilidade no teste técnico. Em produção, utilizaríamos **Migrations** para garantir o controle de versão do esquema do banco de dados e evitar perda de dados acidental.
2. **Transactional Outbox & Relay:** Para garantir 100% de consistência atômica entre o Banco de Dados e o Kafka, o próximo passo seria o uso de um Relay para monitorar a tabela de eventos. A estrutura atual já está preparada para isso, pois persiste o estado `PENDING` antes do despacho, permitindo a recuperação de falhas de comunicação com o Broker sem intervenção manual.
3. **Locks Distribuídos:** A idempotência atual utiliza **Atomic SET NX** no Redis, o que é o estado da arte para travas distribuídas, prevenindo *Race Conditions* em ambientes com múltiplas instâncias da API.

---

**Desenvolvido por Isabelle Brandão**

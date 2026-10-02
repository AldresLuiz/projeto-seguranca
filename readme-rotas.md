# Rotas da API

Referência das rotas registradas pela aplicação Express. Os exemplos usam `http://localhost:<BACKEND_PORT>` como URL base. Corpos e respostas JSON usam `Content-Type: application/json`.

Rotas marcadas como autenticadas exigem o cookie `ACCESS`, criado pelo login. O cookie é `HttpOnly`; em clientes HTTP, mantenha a sessão/cookies entre as requisições. Quando uma rota exigir papel administrativo, isso significa `role > 0`.

## Autenticação

### `POST /auth/register`

Cria uma conta. Não exige autenticação.

Body:

```json
{
  "name": "Jogador",
  "email": "jogador@example.com",
  "password": "senha-segura"
}
```

`name`: no mínimo 3 caracteres (a coluna do banco aceita até 255); `email`: endereço de e-mail válido; `password`: 8 a 72 caracteres. Campos adicionais, como `number`, não fazem parte do DTO e são descartados.

Sucesso (`201`):

```json
{ "message": "Usuario criado com sucesso" }
```

Erros: `400` body inválido; `409` e-mail já cadastrado.

### `POST /auth/login`

Autentica a conta. Não exige autenticação prévia.

Body:

```json
{
  "email": "jogador@example.com",
  "password": "senha-segura"
}
```

Sucesso (`200`): define os cookies `ACCESS` e `REFRESH` e retorna:

```json
{ "message": "Login efetuado com sucesso" }
```

Erros: `400` body inválido; `401` e-mail ou senha incorretos.

### `GET /auth/refresh`

Renova os tokens usando o cookie `REFRESH`; não exige `ACCESS`.

Sucesso (`200`): define novos cookies `ACCESS` e `REFRESH` e retorna:

```json
{ "message": "Token renovado com sucesso" }
```

Erros: `401` refresh token ausente, inválido, expirado ou sessão inválida; `500` erro interno.

### `GET /auth/logout`

Encerra a sessão atual usando o cookie `REFRESH`; não exige `ACCESS`.

Sucesso (`200`): limpa os cookies `ACCESS` e `REFRESH` e retorna:

```json
{ "message": "Logout efetuado com sucesso!" }
```

Erros: `401` refresh token ausente, inválido, expirado ou sessão inválida; `500` erro interno.

### `GET /auth/logoutall`

Invalida todas as sessões da conta usando o cookie `REFRESH`; não exige `ACCESS`.

Sucesso (`200`): limpa os cookies `ACCESS` e `REFRESH` e retorna:

```json
{ "message": "Logout de todas as sessões efetuado." }
```

Erros: `401` refresh token ausente, inválido, expirado ou sessão inválida; `500` erro interno.

## Produtos

### `GET /product/list`

Lista os 20 produtos mais recentes. Não exige autenticação e a resposta pode vir do cache por até 180 segundos.

Sucesso (`200`): array de produtos com `productId`, `ownerId`, `name`, `price`, `type` e `item` (pode ser `null`). Sem resultados, retorna `[]`.

### `GET /product/search`

Pesquisa produtos. Exige autenticação.

Query params opcionais; informe ao menos um. Podem ser combinados:

| Parâmetro | Tipo | Regra |
| --- | --- | --- |
| `name` | string | 3 a 255 caracteres; pesquisa parcial sem diferenciar maiúsculas/minúsculas |
| `ownerId` | UUID | ID do proprietário |
| `productId` | UUID | ID do produto |

Exemplo: `/product/search?name=sword&ownerId=550e8400-e29b-41d4-a716-446655440000`

Sucesso (`200`): array de até 20 produtos com `productId`, `ownerId`, `name`, `price`, `type` e `item`. Sem correspondências, retorna `[]`.

Erros: `400` parâmetros inválidos ou nenhum parâmetro de pesquisa; `401` não autenticado.

### `POST /product/create`

Cria um produto pertencente ao usuário autenticado.

Body:

```json
{
  "name": "Espada de treino",
  "price": 1000,
  "type": "weapon",
  "item": "item-id-opcional",
  "quantity": 5
}
```

`name` e `type`: no mínimo 3 caracteres (a coluna do banco aceita até 255); `price`: inteiro; `item`: opcional, 3 a 255 caracteres; `quantity`: inteiro não negativo, padrão `1`. O proprietário é obtido da sessão, não do body.

Sucesso (`200`):

```json
{ "message": "Produto criado com sucesso" }
```

Erros: `400` body inválido; `401` não autenticado; `500` erro ao criar o produto.

### `POST /product/update`

Atualiza um produto do usuário autenticado. O endpoint não permite atualizar produtos de outro proprietário.

Body: `productId` UUID obrigatório e ao menos um campo de atualização:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Espada aprimorada",
  "price": 1500,
  "type": "weapon",
  "item": "item-id-opcional",
  "quantity": 2
}
```

Os limites de `name`, `price`, `type` e `item` seguem a criação. `quantity` é um inteiro delta: `2` acrescenta duas unidades ao estoque atual, não define o estoque para `2`.

Sucesso (`200`):

```json
{ "message": "Produto atualizado com sucesso" }
```

Erros: `400` body inválido; `401` não autenticado; `500` produto inexistente, de outro proprietário ou erro ao atualizar.

### `DELETE /product/delete/:productId`

Exclui um produto. Exige autenticação. O proprietário pode excluir o próprio produto; usuários com `role > 0` podem excluir qualquer produto.

Path param: `productId` UUID.

Sucesso (`200`): objeto do produto excluído.

Erros: `400` UUID inválido; `401` não autenticado ou usuário inválido; `404` produto inexistente ou sem permissão; `500` erro ao excluir.

## Carrinho

Todas as rotas do carrinho exigem autenticação e operam no carrinho do usuário da sessão.

### `GET /cart/list`

Retorna os itens do carrinho e o total.

Sucesso (`200`):

```json
{
  "items": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440000",
      "ownerId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Espada de treino",
      "price": "1000",
      "type": "weapon",
      "item": null,
      "availableQuantity": 5,
      "cartQuantity": 2
    }
  ],
  "total": "2000"
}
```

`total` é retornado como string para preservar valores inteiros grandes. Carrinho vazio retorna `items: []` e `total: "0"`. Erros: `401` não autenticado; `500` erro interno.

### `POST /cart/items`

Adiciona uma quantidade ao carrinho. Se o produto já estiver no carrinho, as quantidades são somadas.

Body:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "quantity": 2
}
```

`productId` é UUID; `quantity` é inteiro positivo e, se omitido, vale `1`.

Sucesso (`200`): `{ "productId": "...", "quantity": 2 }`, com a quantidade total daquele produto no carrinho.

Erros: `400` body inválido; `401` não autenticado ou usuário inválido; `404` produto não encontrado; `409` quantidade acima do estoque; `500` erro interno.

### `DELETE /cart/items/:productId`

Remove do carrinho todas as unidades do produto indicado.

Path param: `productId` UUID.

Sucesso (`200`): `{ "productId": "...", "quantity": 2 }`, com a quantidade removida.

Erros: `400` UUID inválido; `401` não autenticado ou usuário inválido; `404` produto não encontrado no carrinho; `500` erro interno.

### `POST /cart/checkout`

Finaliza a compra de todos os itens do carrinho. Não recebe body. O estoque é atualizado e o carrinho é esvaziado na mesma transação do banco.

Sucesso (`201`): objeto com `transaction` (campos `transactionId`, `userId`, `amount`, `status`, `createdAt` e `finishedAt`) e `items` (snapshot comprado com `productId`, `name`, `price`, `type`, `item` e `quantity`). O valor `amount` é um inteiro serializado como string.

Erros: `401` não autenticado ou usuário inválido; `409` carrinho vazio ou estoque insuficiente; `500` erro interno.

## Transações

### `GET /transaction/list`

Lista as 20 transações mais recentes do usuário autenticado. A query `page` é aceita e validada, mas não pagina esta listagem; ela sempre retorna as 20 mais recentes.

Sem `transactionId`, sucesso (`200`): array de transações com `transactionId`, `externalId`, `userId`, `amount`, `status`, `createdAt` e `finishedAt`.

Query opcional `transactionId` (UUID): retorna o detalhe somente se a transação pertencer ao usuário autenticado.

Sucesso de detalhe (`200`):

```json
{
  "transaction": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "externalId": null,
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "amount": "2000",
    "status": "completed",
    "createdAt": "2026-10-02T12:00:00.000Z",
    "finishedAt": "2026-10-02T12:00:00.000Z"
  },
  "items": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Espada de treino",
      "price": "1000",
      "type": "weapon",
      "item": null,
      "quantity": 2
    }
  ]
}
```

Erros: `400` query inválida; `401` não autenticado ou usuário inválido; `404` transação não encontrada para esse usuário; `500` erro interno.

### `GET /transaction/admin/list`

Lista todas as transações; exige autenticação e `role > 0`.

Query params:

| Parâmetro | Tipo | Regra |
| --- | --- | --- |
| `page` | inteiro | Mínimo `1`, padrão `1`; cada página contém 20 registros |
| `transactionId` | UUID | Opcional; se informado, retorna o detalhe completo e ignora `page` |

Exemplo: `/transaction/admin/list?page=2`

Sucesso de listagem (`200`):

```json
{
  "page": 2,
  "pageSize": 20,
  "total": 45,
  "totalPages": 3,
  "transactions": []
}
```

Cada entrada de `transactions` contém `transactionId`, `externalId`, `userId`, `amount`, `status`, `createdAt` e `finishedAt`. Com `transactionId`, a resposta é o mesmo formato de detalhe e lista de `items` mostrado na rota pessoal, sem restrição de proprietário.

Erros: `400` query inválida; `401` não autenticado ou usuário inválido; `403` papel insuficiente; `404` transação não encontrada; `500` erro interno.
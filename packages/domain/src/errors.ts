/**
 * Erros de domínio. Separados de erros de infra/HTTP para que a camada de
 * aplicação (NestJS) possa traduzi-los em respostas sem vazar detalhes internos.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Mantém a stack correta em subclasses (V8)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---- Geo ----
export class InvalidCoordinateError extends DomainError {
  constructor(field: 'latitude' | 'longitude', value: number) {
    super(`Coordenada inválida: ${field}=${value}`);
  }
}
export class InvalidBoundsError extends DomainError {}
export class InvalidRouteError extends DomainError {}

// ---- Dinheiro / compras ----
export class InvalidMoneyError extends DomainError {}
export class CurrencyMismatchError extends DomainError {
  constructor(a: string, b: string) {
    super(`Operação entre moedas diferentes: ${a} e ${b}`);
  }
}
export class InvalidQuantityError extends DomainError {}
export class InvalidProductError extends DomainError {}
export class InvalidMarketError extends DomainError {}
export class InvalidPriceError extends DomainError {}
export class InvalidCartError extends DomainError {}

// ---- Identidade / assinatura ----
export class InvalidEmailError extends DomainError {}
export class InvalidSubscriptionError extends DomainError {}

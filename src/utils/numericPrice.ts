/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strict numeric(10,2) implementation simulating PostgreSQL decimal logic on client-side
 */
export const DecimalMath = {
  // Converte string para centavos (inteiro)
  toCents(val: string | number): number {
    const parsed = typeof val === 'number' ? val : parseFloat(val || '0');
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  },

  // Converte centavos de volta para string formato numeric(10,2)
  fromCents(cents: number): string {
    return (cents / 100).toFixed(2);
  },

  // Somar duas strings de preço
  add(a: string, b: string): string {
    const sumCents = this.toCents(a) + this.toCents(b);
    return this.fromCents(sumCents);
  },

  // Subtrair duas strings de preço
  sub(a: string, b: string): string {
    const diffCents = this.toCents(a) - this.toCents(b);
    return this.fromCents(diffCents);
  },

  // Multiplicar string de preço por quantidade ou fator
  mul(a: string, b: string | number): string {
    const priceCents = this.toCents(a);
    const multiplier = typeof b === 'number' ? b : parseFloat(b || '1');
    return this.fromCents(Math.round(priceCents * multiplier));
  },

  // Somatório de array de strings
  sum(arr: string[]): string {
    const totalCents = arr.reduce((acc, val) => acc + this.toCents(val), 0);
    return this.fromCents(totalCents);
  },

  // Formatar para moeda Real brasileira (R$) com suporte a português brasileiro
  formatBRL(val: string): string {
    const parsed = parseFloat(val) || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(parsed);
  },

  // Formatar com sinal (exemplo: +R$ 100,00 ou -R$ 50,00)
  formatBRLWithSign(val: string): string {
    const num = parseFloat(val) || 0;
    const formatted = this.formatBRL(Math.abs(num).toString());
    if (num > 0) return `+ ${formatted}`;
    if (num < 0) return `- ${formatted}`;
    return formatted;
  }
};

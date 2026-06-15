type Token = number | '+' | '-' | '*' | '/';

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

function tokenize(expression: string): Token[] {
  const matches = expression.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!matches) return [];
  return matches.map((token) => (/[+\-*/]/.test(token) && token.length === 1 ? (token as Token) : Number(token)));
}

/** Evaluate a simple arithmetic expression with + - * / and correct precedence. No eval(). */
export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;

  const output: Token[] = [];
  const operators: Array<'+' | '-' | '*' | '/'> = [];

  for (const token of tokens) {
    if (typeof token === 'number') {
      output.push(token);
    } else {
      while (operators.length > 0 && PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]) {
        output.push(operators.pop() as Token);
      }
      operators.push(token);
    }
  }
  while (operators.length > 0) {
    output.push(operators.pop() as Token);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (typeof token === 'number') {
      stack.push(token);
      continue;
    }
    const right = stack.pop() ?? 0;
    const left = stack.pop() ?? 0;
    if (token === '+') stack.push(left + right);
    else if (token === '-') stack.push(left - right);
    else if (token === '*') stack.push(left * right);
    else stack.push(right === 0 ? 0 : left / right);
  }

  const result = stack.pop() ?? 0;
  if (!Number.isFinite(result)) return 0;
  return Math.round(result * 100) / 100;
}

const OP_MAP: Record<string, string> = { '÷': '/', '×': '*', '−': '-', '+': '+' };

/** Apply a calculator keypress to an expression string and return the next expression. */
export function applyCalcKey(expr: string, key: string): string {
  if (key === '⌫') return expr.slice(0, -1);

  if (key in OP_MAP) {
    const op = OP_MAP[key];
    if (!expr) return op === '-' ? '-' : expr;
    if (/[+\-*/]$/.test(expr)) return expr.slice(0, -1) + op;
    return expr + op;
  }

  if (key === '.') {
    const lastNumber = expr.split(/[+\-*/]/).pop() ?? '';
    if (lastNumber.includes('.')) return expr;
    return expr === '' || /[+\-*/]$/.test(expr) ? `${expr}0.` : `${expr}.`;
  }

  return expr + key;
}

export { OP_MAP };

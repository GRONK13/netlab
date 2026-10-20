import type { ReactNode } from 'react';
import { Inline } from './Briefing.tsx';
import { SubnetExplorer } from './SubnetExplorer.tsx';

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

function widget(line: string, key: number): ReactNode {
  const [name, arg] = line.slice(3).trim().split(/\s+/);
  if (name === 'subnet-explorer') return <SubnetExplorer key={key} initial={arg} />;
  return null;
}

/**
 * Lesson markdown, rendered to React elements (never innerHTML): paragraphs, `### `
 * subheadings, "- " and "1. " lists, tables, fenced code, `> ` tips and `::: widget` lines.
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  // Collects consecutive lines that match `test`, advancing past them.
  const run = (test: (l: string) => boolean) => {
    const block: string[] = [];
    while (i < lines.length && test(lines[i]!)) block.push(lines[i++]!);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const key = out.length;
    if (line.startsWith('```')) {
      i++;
      const code = run((l) => !l.startsWith('```'));
      i++;
      out.push(
        <pre key={key} className="code-block">
          <code>{code.join('\n')}</code>
        </pre>,
      );
    } else if (line.startsWith(':::')) {
      out.push(widget(line, key));
      i++;
    } else if (line.startsWith('### ')) {
      out.push(<h3 key={key}>{line.slice(4)}</h3>);
      i++;
    } else if (line.startsWith('> ')) {
      const tip = run((l) => l.startsWith('> ')).map((l) => l.slice(2));
      out.push(
        <aside key={key} className="tip">
          <Inline text={tip.join(' ')} />
        </aside>,
      );
    } else if (line.startsWith('|')) {
      const [head = '', , ...body] = run((l) => l.startsWith('|'));
      out.push(
        <div key={key} className="table-wrap">
          <table className="lesson-table">
            <thead>
              <tr>
                {cells(head).map((c, j) => (
                  <th key={j}>
                    <Inline text={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {cells(row).map((c, j) => (
                    <td key={j}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (line.startsWith('- ')) {
      const items = run((l) => l.startsWith('- '));
      out.push(
        <ul key={key}>
          {items.map((l, j) => (
            <li key={j}>
              <Inline text={l.slice(2)} />
            </li>
          ))}
        </ul>,
      );
    } else if (/^\d+\. /.test(line)) {
      const items = run((l) => /^\d+\. /.test(l));
      out.push(
        <ol key={key}>
          {items.map((l, j) => (
            <li key={j}>
              <Inline text={l.replace(/^\d+\. /, '')} />
            </li>
          ))}
        </ol>,
      );
    } else {
      if (line.trim()) {
        out.push(
          <p key={key}>
            <Inline text={line} />
          </p>,
        );
      }
      i++;
    }
  }
  return <div className="markdown">{out}</div>;
}

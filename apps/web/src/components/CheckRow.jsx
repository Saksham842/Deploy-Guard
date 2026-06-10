import Badge from './Badge';
import { Link } from 'react-router-dom';

// Renders a single check row inside the RepoDetail checks table.
export default function CheckRow({ check, owner, name }) {
  const delta = check.results?.bundle_kb?.delta;
  const deltaStr = delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '—';
  const deltaClass = delta > 10 ? 'text-red-500' : delta > 5 ? 'text-yellow-500' : delta <= 0 ? 'text-green-500' : 'text-slate-400';
  const date = new Date(check.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const topCause = check.causes?.[0];

  return (
    <tr>
      <td>
        <a
          href={`https://github.com/${owner}/${name}/pull/${check.pr_number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 no-underline font-semibold hover:underline"
        >
          #{check.pr_number}
        </a>
      </td>
      <td><Badge status={check.status} /></td>
      <td className={`font-semibold font-mono ${deltaClass}`}>{deltaStr}</td>
      <td>
        {topCause ? (
          <span className="text-xs bg-[#141d35] px-2 py-0.5 rounded text-slate-400">
            {topCause.cause_type.replace(/_/g, ' ')} · {Math.round(topCause.confidence * 100)}%
          </span>
        ) : '—'}
      </td>
      <td className="text-slate-500 text-xs">{date}</td>
    </tr>
  );
}

// Array of objects as a filterable table. Scalar fields become columns; nested values expand in place.
import { useMemo, useState } from 'react';

import { humanizeKey, isScalar } from '../lib/humanize.js';
import DataValue from './DataValue.jsx';
import DataView from './DataView.jsx';
import Icon from './Icon.jsx';

const PAGE_SIZE = 25;
const MAX_COLUMNS = 8;

export default function DataTable({ rows, depth }) {
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { scalarKeys, complexKeys } = useMemo(() => {
    const scalars = [];
    const complex = [];
    rows.slice(0, 200).forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        const bucket = isScalar(value) ? scalars : complex;
        if (value !== null && value !== undefined && !scalars.includes(key) && !complex.includes(key)) {
          bucket.push(key);
        }
      });
    });
    return { scalarKeys: scalars.slice(0, MAX_COLUMNS), complexKeys: complex };
  }, [rows]);

  const needle = filter.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)) : rows),
    [rows, needle],
  );

  return (
    <div className="data-table">
      {rows.length > 8 && (
        <label className="search search-sm">
          <Icon name="search" size={16} />
          <span className="sr-only">Filter rows</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter ${rows.length} rows`}
          />
        </label>
      )}
      <div className="table-wrap inner">
        <table>
          <thead>
            <tr>
              {scalarKeys.map((key) => (
                <th key={key}>{humanizeKey(key)}</th>
              ))}
              {complexKeys.length > 0 && <th>Details</th>}
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, limit).map((row, index) => (
              <tr key={index}>
                {scalarKeys.map((key) => (
                  <td key={key} data-label={humanizeKey(key)}>
                    <DataValue name={key} value={row[key]} />
                  </td>
                ))}
                {complexKeys.length > 0 && (
                  <td data-label="Details">
                    {complexKeys
                      .filter((key) => row[key] !== undefined && row[key] !== null)
                      .map((key) => (
                        <details key={key} className="inline-details">
                          <summary>{humanizeKey(key)}</summary>
                          <DataView value={row[key]} depth={depth + 2} />
                        </details>
                      ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matches.length === 0 && <p className="muted pad-sm">No rows match.</p>}
      {matches.length > limit && (
        <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Show more ({matches.length - limit} left)
        </button>
      )}
    </div>
  );
}

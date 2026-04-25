export default function Badge({ status }) {
  const config = {
    pass:    { label: '✅ Pass',    cls: 'badge-pass'    },
    fail:    { label: '❌ Fail',    cls: 'badge-fail'    },
    pending: { label: '⏳ Running', cls: 'badge-pending' },
    error:   { label: '⚠️ Error',   cls: 'badge-error'   },
  }
  const { label, cls } = config[status] || config.error
  return <span className={`badge ${cls}`}>{label}</span>
}

const formatReplicationKey = (id) => {
  id = id.toString().padStart(9, '0');
  return [
    'planet',
    'replication',
    'minute',
    id.slice(0, 3),
    id.slice(3, 6),
    id.slice(6) + ".osc.gz"
  ].join("/");
}

module.exports = {
  formatReplicationKey,
}
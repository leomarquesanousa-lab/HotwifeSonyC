export function filterCatalog(entries, search = '', participant = '', direction = 'asc') {
  const query = search.trim().toLocaleLowerCase('en-US');
  return entries.filter(entry => entry.status === 'active' && (!participant || entry.participants.includes(participant)) && `${entry.title} ${entry.participantsRaw}`.toLocaleLowerCase('en-US').includes(query)).sort((a,b) => direction === 'desc' ? b.number-a.number : a.number-b.number);
}

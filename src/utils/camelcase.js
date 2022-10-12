const camelcase = (string) =>
  string[0].toLowerCase() +
  string
    .slice(1)
    .replace(/(_\p{L})/gu, (match, group) => group[1].toUpperCase());

export default camelcase;

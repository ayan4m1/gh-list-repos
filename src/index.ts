import { program } from 'commander';

import { getPackageInfo, listRepos } from './utils.js';

try {
  const { name, version, description } = await getPackageInfo();
  const handler = () => listRepos(program.opts());

  await program
    .name(name)
    .version(version)
    .description(description)
    .option('--list-sort-fields', 'Print a list of all sort field keys')
    .option('-l,--limit <number>', 'Maximum number of repos to return')
    .option('-o,--owner <value>', 'Filter based on organization/owner name')
    .option('-n,--name <value>', 'Filter based on repo name')
    .option(
      '-s,--sort <descriptor>',
      'Sort field and direction (e.g. "pushed:asc")'
    )
    .option(
      '-v,--visibility <value>',
      'Filter by repo visibility (public, private, or all)',
      'public'
    )
    .action(handler)
    .parseAsync();
} catch (error) {
  console.error(error);
  process.exit(1);
}

export default listRepos;

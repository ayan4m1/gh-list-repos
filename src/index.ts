import { program } from 'commander';

import { getPackageInfo, listRepos } from './utils.js';

try {
  const { name, version, description } = await getPackageInfo();
  const handler = () => listRepos(program.opts());

  await program
    .name(name)
    .version(version)
    .description(description)
    .option('-u, --username', 'Specify user to list repos for')
    .option('-o, --organization', 'Specify org to list repos for')
    .option('-t, --token', 'Specify auth token if you already have one')
    .option('-v, --visibility', 'Filter based on repo visibility')
    .option('-n, --name', 'Filter based on repo name')
    .option('-s, --skip', 'Number of repos to skip')
    .option('-l, --limit', 'Maximum number of repos to return')
    .option('-S, --sort', 'Sort field and direction (see help)')
    .action(handler)
    .parseAsync();
} catch (error) {
  console.error(error);
  process.exit(1);
}

export default listRepos;

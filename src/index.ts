import { program } from 'commander';

import { getPackageInfo, listRepos } from './utils.js';

try {
  const { name, version, description } = await getPackageInfo();
  const handler = () => listRepos(program.opts());

  await program
    .name(name)
    .version(version)
    .description(description)
    .option('-u, --username <value>', 'Specify user to list repos for')
    .option('-o, --organization <value>', 'Specify org to list repos for')
    .option('-t, --token <value>', 'Specify auth token if you already have one')
    .option('-i, --interactive', 'Perform an interactive login to GitHub')
    .option('-v, --visibility <value>', 'Filter based on repo visibility')
    .option('-n, --name <value>', 'Filter based on repo name')
    .option('-l, --limit <number>', 'Maximum number of repos to return')
    .option(
      '-S, --sort <field>:<direction>',
      'Sort field and direction (see help)'
    )
    .action(handler)
    .parseAsync();
} catch (error) {
  console.error(error);
  process.exit(1);
}

export default listRepos;

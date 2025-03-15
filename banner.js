import chalk from 'chalk';

export default function displayBanner() {
    console.log(chalk.white(`
       ${chalk.red('██')}${chalk.blue('╗')}${chalk.red('██████')}${chalk.blue('╗')}  ${chalk.red('█████')}${chalk.blue('╗')}${chalk.red('██')}${chalk.blue('╗')}   ${chalk.red('██')}${chalk.blue('╗')}  ${chalk.red('█████')}${chalk.blue('╗')}${chalk.red('███')}${chalk.blue('╗')}
       ${chalk.red('██')}${chalk.blue('║')}${chalk.red('██')}${chalk.blue('╔══')}${chalk.red('██')}${chalk.blue('╗')}${chalk.red('██')}${chalk.blue('╔══')}${chalk.red('██')}${chalk.blue('╗')}${chalk.red('██')}${chalk.blue('╗')} ${chalk.red('██')}${chalk.blue('╔╝')}     ${chalk.red('██')}${chalk.blue('╝')} ${chalk.red('██')}${chalk.blue('║')}
       ${chalk.red('██')}${chalk.blue('║')}${chalk.red('██████')}${chalk.blue('╔╝')}${chalk.red('███████')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('╔╝')}     ${chalk.red('██')}${chalk.blue('║')}   ${chalk.red('██')}${chalk.blue('║')}
       ${chalk.red('██')}${chalk.blue('║')}${chalk.red('██')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('╗')}${chalk.red('██')}${chalk.blue('╔══')}${chalk.red('██')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('║')}     ${chalk.red('█████')}${chalk.blue('║')} ${chalk.red('██')}${chalk.blue('║')}
       ${chalk.red('██')}${chalk.blue('║')}${chalk.red('██')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('║')}${chalk.red('██')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('║')}  ${chalk.red('██')}${chalk.blue('║')}     ${chalk.blue('╚════╝')} ${chalk.blue('╚═╝')}
       ${chalk.blue('╚═╝╚═╝')}  ${chalk.blue('╚═╝╚═╝')}  ${chalk.blue('╚═╝')}  ${chalk.blue('╚═╝')}  El-Psy-Kongroo
      < <  エ ル ・ プ サ イ ・ コングルゥ  > >

  ${chalk.white('•••')} ${chalk.red('Easy Register Kite-AI')} ${chalk.white('|')} ${chalk.blue('github.com/Iray-21')} ${chalk.white('•••')}
    `));
}

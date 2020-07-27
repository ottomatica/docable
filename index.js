#! /usr/bin/env node
const yargs = require('yargs');
const path = require('path')
const chalk = require('chalk');

const Stepper = require('./lib/read/stepper');
const Reporter = require('./lib/read/reporter');

(async () => {

    yargs.command('report <doc> [html]', 'Test markdown/steps file and report feedback into rendered output', 
        (yargs) => {
            yargs.positional('html', {
                describe: 'html file to execute'
            })        
        }, 
        async (argv) => {
            await docable(argv, true);
        })
        .option({
            output: {
                alias: 'o',
                describe: 'output report path',
                type: 'string'
            }
        });

    yargs.command('run <doc> [html]', 'Execute markdown/steps file', 
        (yargs) => {
            yargs.positional('html', {
                describe: 'html file to execute'
            })        
        }, 
        async (argv) => {
            await docable(argv, false);
        })
        .option({
            output: {
                alias: 'o',
                describe: 'output report path',
                type: 'string'
            }
        });

    // Turn on help and access argv
    yargs.help().argv;

})();

async function docable(argv, report, verbose = true) {
    let stepper = new Stepper(path.resolve(argv.doc), argv.html ? path.resolve(argv.html) : undefined);
    await stepper.setup();
    const { $, results, status } = await stepper.run();

    // print execution results in console
    if (verbose) {
        for (const r of results) {
            // print task result
            console.log(chalk`{${r.result.status ? 'green' : 'red'} ${JSON.stringify({ ...r.result, status: undefined }, null, 2)}}`);
        }

        const passingCount = results.filter(r => r.status).length;
        const failingCount = results.filter(r => !r.status).length;
        const summaryColor = failingCount > 0 ? 'red' : 'green';

        // print summary of tasks
        console.log(chalk`{${summaryColor} \nSummary: ${Number((passingCount / results.length).toFixed(1))}% of all tasks passed.} ` +
            chalk`{${summaryColor} ${passingCount} passed - ${failingCount} failed.}`);
    }

    if (report) {
        const reporter = new Reporter($, results);
        await reporter.report(argv.output);
    }

    process.exitCode = status ? 0 : 1;

    // TODO:
    // await stepper.tearDown();

    return results;
}

module.exports = docable;

#! /usr/bin/env node
const yargs = require('yargs');

const Stepper = require('./lib/read/stepper');
const Reporter = require('./lib/read/reporter');

(async () => {

    yargs.command('report <doc> [html]', 'Test markdown/steps file and report feedback into rendered output', (yargs) => { }, async (argv) => {
        await docable(argv, true);
    });

    // Turn on help and access argv
    yargs.help().argv;

})();

async function docable(argv, report) {
    let stepper = new Stepper(argv.doc, argv.html);
    await stepper.setup();
    const { $, results } = await stepper.run();

    if (report) {
        const reporter = new Reporter($, results);
        let docStatus = await reporter.report();
        process.exitCode = docStatus ? 0 : 1;
    }

    // TODO:
    // await stepper.tearDown();

    return results;
}

module.exports = docable;

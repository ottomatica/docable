const cheerio = require('cheerio');
const Connector = require('infra.connectors');
const chalk  = require('chalk');

const transformers = require('../transformers');
const Setup = require('./setup');
const Operators = require('../infra/operators');
const Infra     = require('../infra/infrastructure');

const yaml = require('js-yaml');

class Stepper {

    constructor(doc, html) {
        this.doc = doc;
        this.html = html;
    }

    async setup(setupObj) {
        const setup = new Setup();
        const { conn, cwd, html, docPath, targets, clean, verify } = await setup.setup(this.doc, this.html, setupObj);
        this.html = html;

        this.cwd = cwd;
        this.conn = conn;
    }

    async buildConnector(setupObj, cwd) {
        const provider = Object.keys(setupObj)[0];
        let conn = await Infra.select(setupObj, provider, cwd);
        return conn;
    }

    async getSetupFromDocument(doc)
    {
        const setup = new Setup();
        let setupString = await setup.extractSetup(doc);
        return yaml.safeLoad(setupString).setup;
    }

    /**
     * Run current stepper obj's cells and return $ + results obj:
     * [
     *   {cell : {content, path, user, persistent, etc}, result: {status, exitCode, stdout, stderr}},
     *   ...
     * ]
     * 
     * @param {Number} stepIndex index of the cell to execute
     * @param {String} IR optionally pass IR for the execution.
     */
    async run(stepIndex, IR) {
        let { cells, $ } = await this._parse(IR);

        let connector = this.conn || Connector.getConnector('local');
        let cwd = this.cwd || '.';

        return this.runStep(cells, $, connector, cwd, stepIndex );
    }

    async runStep(cells, $, conn, cwd, stepIndex)
    {
        let results = [];
        let status = true;

        const op = new Operators(conn, cwd);

        // only run the specified index if specified
        if (stepIndex != undefined) cells = [cells[stepIndex]];

        for (const cell of cells) {
            let result;
            switch (cell.type) {
                case 'file':
                    result = await op.file(cell.content, cell.path, cell.user);
                    break;
                case 'command':
                    result = await op.run(cell.content, cell.user, cell.persistent);
                    break;
                case 'edit':
                    result = await op.edit(cell.content, cell.path, cell.user);
                default:
                    break;
            }

            if(cell.failedWhen)
                result.status = !eval(cell.failedWhen
                                        .replace('exitCode', 'result.exitCode')
                                        .replace('stderr', 'result.stderr')
                                        .replace('stdout', 'result.stdout'));

            else
                result.status = result.exitCode == 0 && result.stderr === "";

            let execLog = `${JSON.stringify({ ...result, status: undefined }, null, 2)}`;

            const printColor = result.status ? 'green' : 'red';
            if (!Boolean(result.stderr)) {
                console.log(chalk`{${printColor} ${execLog}}`);
            }
            else {
                console.error(chalk`{${printColor} ${execLog}}`); // Write to stderr
            }

            results.push({
                cell,
                result
            });

            status = status && result.status;
        }
        
        return { results, $, status };
    }

    async _parse(IR) {
        if(!IR) {
            if (this.doc && this.html)
                IR = await transformers.step.transform(this.doc, this.html);
            else
                IR = await transformers.inline.transform(this.doc);
        }

        let cells = [];

        const $ = cheerio.load(IR);
        $('[data-docable="true"]').each(function (index, elem) {
            cells.push({
                index,
                content: $(elem).text().trim(),
                ...$(elem).data(),
                elem
            });
        });

        return { cells, $ };
    }

}

module.exports = Stepper;

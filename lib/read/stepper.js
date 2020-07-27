const cheerio = require('cheerio');
const Connector = require('infra.connectors');
const chalk  = require('chalk');

const transformers = require('../transformers');
const Setup = require('./setup');
const Operators = require('../infra/operators');

class Stepper {

    constructor(doc, html) {
        this.doc = doc;
        this.html = html;
    }

    async setup() {
        const setup = new Setup();
        const { conn, cwd, html, docPath, targets, clean, verify } = await setup.setup(this.doc, this.html);
        this.html = html;

        this.cwd = cwd;
        this.conn = conn;
    }

    /**
     * Run current stepper obj's cells and return $ + results obj:
     * [
     *   {cell : {content, path, user, persistent, etc}, result: {status, exitCode, stdout, stderr}},
     *   ...
     * ]
     */
    async run() {
        let { cells, $ } = await this._parse();

        const op = new Operators(this.conn || Connector.getConnector('local'), this.cwd || '.');
        let results = [];
        let status = true;

        for (const cell of cells) {
            let result;
            switch (cell.type) {
                case 'file':
                    result = await op.file(cell.content, cell.path, cell.user);
                    break;
                case 'command':
                    result = await op.run(cell.content, cell.user, cell.persistent);
                    break;
                default:
                    break;
            }

            result.status = result.exitCode == 0 && result.stderr === "";

            let execLog = `${JSON.stringify({ ...result, status: undefined }, null, 2)}`;
            if( result.status ) {
                console.log(chalk`{green ${execLog}}`);
            }
            else {
                console.error(chalk`{red ${execLog}}`); // Write to stderr
            }

            results.push({
                cell,
                result
            });

            status = status && result.status;
        }
        
        return { results, $, status };
    }

    async _parse() {
        let IR;
        if (this.doc && this.html)
            IR = await transformers.step.transform(this.doc, this.html);
        else
            IR = await transformers.inline.transform(this.doc);

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

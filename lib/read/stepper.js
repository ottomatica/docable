const cheerio = require('cheerio');
const Connector = require('infra.connectors');
const chalk  = require('chalk');

const fs = require('fs');
const transformers = require('../transformers');
const Setup = require('./setup');
const Operators = require('../infra/operators');
const Infra     = require('../infra/infrastructure');

const yaml = require('js-yaml');
const mustache = require('mustache');
var events = require('events');

class Stepper {

    constructor(doc, html) {
        this.doc = doc;
        this.html = html;

        // For clients to listen to step progress
        this.progress = new events.EventEmitter();
    }

    async setup(setupObj) {
        const setup = new Setup();
        const { conn, cwd, html, docPath, targets, clean, verify } = await setup.setup(this.doc, this.html, setupObj);
        this.html = html;

        this.cwd = cwd;
        this.conn = conn;
    }

    async buildConnector(setupObj, cwd, docDir) {
        let connectors = [];

        for (let target of setupObj.targets) {
            connectors.push({ name: target.slug || target.name, connector: await Infra.select(target, cwd, docDir) });
        }

        this.docDir = docDir;

        return connectors;
    }

    async getSetupFromDocument(doc) {
        const setup = new Setup();
        let setupString = await setup.extractSetup(doc);
        return yaml.safeLoad(setupString);
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

        return this.runSteps(cells, $, connector, cwd, stepIndex );
    }

    async runSteps(cells, $, connectors, cwd, stepIndex, vars) {
        let results = [];
        let status = true;

        // only run the specified index if specified
        if (stepIndex != undefined) cells = [cells[stepIndex]];

        // Disable html escaping! We want literal values!
        mustache.escape = function (value)
        {
            return value;
        };

        for (const cell of cells) {

            const cellTargetConnector = connectors.filter(conn => conn.name == cell.target)[0] || connectors[0];
            const op = new Operators(cellTargetConnector.connector, cwd);

            if (cell.variables) {
                const variables = cell.variables.split(',').map(v => v.trim());
                for (const variable of variables) {
                    if (vars[variable] == undefined) 
                        throw Error(`Error: "${variable}" variable is not provided.`);
                }
                cell.content = mustache.render(cell.content, vars);
            }

            let result;
            let cleanUp;
            switch (cell.type) {

                case 'copy':
                    // This is set in buildConnector when called through fromHtml.
                    let cwd = this.docDir || process.cwd;
                    result = await op.copy(cell, cwd);
                    break;
                case 'file':
                    result = await op.file(cell.content, cell.path, cell.user, undefined, cell.permission, cell.mode);
                    break;
                case 'script':
                {
                    if (cell.lang === "js") {
                        const contentWrapedInAsync = `(async () => {\n${cell.content}\n})();`;
                        let scriptPath = await cellTargetConnector.connector.writeTempFile("docable.js", contentWrapedInAsync);

                        let runnerScript = 
                        `
                        const child_process = require('child_process');
                        const path = require('path')
                        const fs = require('fs');

                        const scriptPath = '${scriptPath.replace(/\\/g, '\\\\')}';
                        const ScriptSrc = fs.readFileSync(scriptPath, {encoding: 'utf-8'});
                        const mList = [...ScriptSrc.matchAll(/(?:require\\s*\\(\\s*(?:'|"))(.*?)(?:(?:'|")\\s*\\))/g)].map(m => m[1]);

                        let satisfiedDeps = JSON.parse(child_process.spawnSync(\`npm list \${mList.join(' ')} --json\`, {cwd: path.dirname(scriptPath), shell: true}).stdout.toString());
                        satisfiedDeps = satisfiedDeps.dependencies ? Object.keys(satisfiedDeps.dependencies) : [];

                        const unsatisfiedDeps = mList.filter(m => !satisfiedDeps.includes(m))
                                                    .filter(m => {
                                                        try { require.resolve(m); }
                                                        catch (err) { return true; }
                                                    });
                        if(unsatisfiedDeps.length > 0)
                            child_process.spawnSync(\`npm install \${unsatisfiedDeps.join(' ')}\`, {cwd: path.dirname(scriptPath), shell: true, stdio: 'ignore'});
                        `;

                        let scriptRunnerPath = await cellTargetConnector.connector.writeTempFile("docable-script-runner.js", runnerScript);

                        cell.content = `node "${scriptRunnerPath}" && node "${scriptPath}" `;
                        cleanUp = scriptPath;
                    }

                    if (cell.lang === "ruby") {
                        let scriptPath = await cellTargetConnector.connector.writeTempFile("docable.rb", cell.content);
                        cell.content = `ruby "${scriptPath}"`;
                        cleanUp = scriptPath;
                    }

                    /* intentional fall-through */ 
                }
                case 'command':
                    let onProgress;
                    if( cell.stream )
                    {
                        let self = this;
                        onProgress = function(data) {
                            self.progress.emit('data', data);
                        };                        
                    }
                    result = await op.run(cell, onProgress);
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

            // Clean up any local tmpfiles
            if (cleanUp && cellTargetConnector.connector.type == "local") {
                try { fs.promises.unlink(cleanUp); }
                catch (e) { console.log(e); }
            }
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

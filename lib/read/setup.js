const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const git  = require('simple-git');
const Connector = require('infra.connectors');
const got  = require('got');

const Infra     = require('../infra/infrastructure');

// Handles reading and processing setup block of stepfile
class Setup {

    /**
     * Setup the env needed for execution
     * @param {String} doc path to steps.yml to inline md file
     * @param {String} html Override html file referenced in steps.yml. Otherwise, if no html file is specified in steps.yml, steps will be executed on provided file.
     */
    async setup(doc, html) {
        let targetHtml = undefined;
        let setupString;

        // if step
        if (doc.endsWith('.yml') || doc.endsWith('.yaml')) {
            targetHtml = await this.ensureSources(doc, html);
            setupString = await fs.promises.readFile(doc, { encoding: 'utf-8' });
        }

        // if inline
        else {
            const $ = cheerio.load(await fs.promises.readFile(doc, { encoding: 'utf-8' }));
            setupString = $.root().contents().filter(function () { return this.type == 'comment'; }).get(0).data;
        }

        const setupObj = yaml.safeLoad(setupString).setup;
        
        // if any setup config specified`
        if(setupObj) {
            const provider = Object.keys(setupObj)[0];
            let cwd = provider === 'local' ? path.resolve(path.dirname(doc)) : '.';
            
            let docPath = path.dirname(doc);
            
            // If using git repo, clone repo and update cwd/docPath
            if (Object.keys(setupObj).includes('git')) {
                console.log(`Cloning or pulling: ${setupObj.git}`);
                docPath = await this._cloneOrPull(setupObj.git, path.dirname(doc));
                cwd = docPath;
            }
            
            // If using targets
            let targets = {};
            if (Object.keys(setupObj).includes('targets')) {
                targets = await this._createTargetConnections(setupObj.targets, cwd);
            }
            
            // clean stanza
            let clean;
            if (Object.keys(setupObj).includes('clean')) {
                clean = setupObj.clean;
            }

            // let verify;
            let verify;
            if (Object.keys(setupObj).includes('verify')) {
                verify = setupObj.verify;
            }

            let conn = await Infra.select(setupObj, provider, cwd);

            return { conn, cwd, docPath, targets, clean, verify, html: targetHtml };
        }

        // use local connector if no setup configuration specified
        else {
            const conn = Connector.getConnector('local');
            return { conn, cwd: '.', html: targetHtml };
        }

    }

    async ensureSources(stepFile, html) {

        const stepFileObj = yaml.safeLoad(await fs.promises.readFile(stepFile, { encoding: 'utf-8' }));
        const stepFileDirname = path.dirname(stepFile);

        let sources = [];
        if (html) sources = [html];
        else sources = Object.keys(stepFileObj).filter(k => k != 'setup');

        for (let source of sources) {

            const key = source;
            // if source is in a remote git repository
            if (source.startsWith('git:')) {

                // remove `git:`
                source = source.slice(4);

                if (!source.startsWith('http://') && !source.startsWith('https://'))
                    source = 'https://' + source;

                const { repoUrl, repoPath } = this._git2path(source);

                try {
                    await this._cloneOrPull(repoUrl, stepFileDirname);
                    return {
                        path: path.join(stepFileDirname, repoPath),
                        key
                    }
                }
                catch (err) {
                    console.error(`Failed to clone git repository: ${source}`, err.message)
                }
            }

            // if source is a remote URL
            else if (source.startsWith('url:')) {

                // remove `url:`
                source = source.slice(4);

                if (!source.startsWith('http://') && !source.startsWith('https://'))
                    source = 'https://' + source;

                try {
                    const fileName = path.basename(source) + '.html';
                    const filePath = path.join(stepFileDirname, fileName);
                    const body = (await got(source, { responseType: 'buffer' })).body;
                    await fs.promises.writeFile(filePath, body);
                    return {
                        path: filePath,
                        key
                    }
                }
                catch (err) {
                    console.error(`Failed to access source: ${source}`, err.message);
                }
            }

            // if source is a local html
            else {
                try {

                    let absSource;

                    // if full path is already provided in args
                    if (path.isAbsolute(source) || source.startsWith('~/'))
                        absSource = source;
                    else
                        absSource = path.join(stepFileDirname, source)

                    await fs.promises.access(absSource, fs.constants.F_OK);
                    return {
                        path: absSource,
                        key
                    }
                }
                catch (err) {
                    console.error(`Source file not found: ${source}`);
                }
            }
        }
    }

    /**
     * extract repo URL, dest path, and the steps.yml key from git:https://github.com/user/repo/path/to/file.html
     * @param {String} gitPath path to a file in a repository =>  git:https://github.com/user/repo/path/to/file.html
     */
    _git2path(gitPath) {
        const repoUrl = gitPath.match(/(?:http:\/\/|https:\/\/).+?\/.+?\/.+?\//)[0];

        let repoName = path.basename(repoUrl);
        repoName = repoName.slice(-4) === '.git' ? repoName.slice(0, -4) : repoName;

        let repoPath = path.join(repoName, gitPath.replace(repoUrl, ''));

        return {
            repoUrl,
            repoPath
        };
    }

    async _url2path() {

    }

    async _cloneOrPull(gitUrl, dest) {
        let name = path.basename(gitUrl);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let repoDir = path.join(dest, name);


        try {
            await fs.promises.access(path.join(dest, name, '.git'), fs.constants.F_OK);
            await git(repoDir).silent(true).pull(gitUrl);
        }
        catch (err) {
            await git(dest).silent(true).clone(gitUrl);
        }
        return repoDir;
    }

    async _createTargetConnections(targets, cwd)
    {
        let targetsDict = {};
        for ( let target of targets )
        {
            let provider = Object.keys(target)[0];
            switch( provider )
            {
                case 'baker':
                    let bakerPath = target[provider];
                    let realPath = path.join(cwd, bakerPath);
                    let connector = Connector.getConnector('baker', realPath, {});
                    let name = await connector.getName();
                    targetsDict[name] = connector;
                    break;
                case 'ssh':
                    let sshObject = target[provider];
                    let conn = Connector.getConnector('ssh', 
                        sshObject.host, {privateKey: this._resolvePath(sshObject.privateKey)});
                    targetsDict[sshObject.name] = conn;
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);   
            }    
        }
        return targetsDict;
    }

    _resolvePath(destPath) {
        if (!destPath) return destPath;
        if (destPath.slice(0, 2) !== '~/') return path.resolve(destPath);
        return path.resolve(path.join(os.homedir(), destPath.slice(2)));
    }
}

module.exports = Setup;

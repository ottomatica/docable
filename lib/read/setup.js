const path = require('path');
const fs   = require('fs');

const git  = require('simple-git');
const Infra     = require('../infra/infrastructure');

const Connector = require('infra.connectors');

// Handles reading and processing setup block of stepfile
class Setup {

    async setup(doc, stepFile)
    {
        let provider = Object.keys(doc.setup)[0];
        let cwd = provider === 'local' ? path.join(process.cwd(), path.dirname(stepFile), 'docable_results') : '.';

        let docPath = path.dirname(stepFile);
        // If using git repo, clone repo and update cwd/docPath
        if( Object.keys(doc.setup).includes('git') )
        {
            console.log(`Cloning or pulling: ${doc.setup.git}`);
            docPath = await this.cloneOrPull( doc.setup.git, path.dirname(stepFile) );
            cwd = docPath;
        }

        // If using targets
        let targets = {};
        if( Object.keys(doc.setup).includes('targets') )
        {
            targets = await this.createTargetConnections(doc.setup.targets, cwd);
        }

        // clean stanza
        let clean;
        if( Object.keys(doc.setup).includes('clean') )
        {
            clean = doc.setup.clean;
        }

        let verify;
        if( Object.keys(doc.setup).includes('verify') )
        {
            verify = doc.setup.verify;
        }

        let conn = await Infra.select( doc, provider, path.dirname(stepFile))

        return {conn, cwd, docPath, targets, clean, verify};
    }

    async cloneOrPull(repoURL, dest) {
        let name = path.basename(repoURL);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let repo_dir = path.join(dest, name);

        return new Promise((resolve, reject) => {

            // Run git pull if repo already exists locally
            if( fs.existsSync(repo_dir) )
            {
                git(repo_dir).pull( (err, data) =>
                {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                })
            }
            else // clone
            {
               git(dest).silent(true).clone(repoURL, (err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(repo_dir);
                });
            }
        });
    }

    async createTargetConnections(targets, cwd)
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
                default:
                    throw new Error(`Unsupported provider: ${provider}`);   
            }    
        }
        return targetsDict;
    }
}

module.exports = Setup;

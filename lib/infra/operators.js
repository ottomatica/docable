const chalk = require('chalk');
const path  = require('path');
const os    = require('os');
const fs = require('fs');
const child_process = require('child_process');
const { v4: uuidv4 } = require('uuid');

class Operators {
    constructor(connector, cwd, targets)
    {
        this.connector = connector;
        this.cwd = cwd;
        connector.setCWD(cwd);
        this.spawnedPids = [];
        this.targets = targets;
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    getConnector(name)
    {
        if( name && Object.keys(this.targets).includes(name) )
        {
            console.log(`Retrieving target ${name}`);
            return this.targets[name];            
        }
        return this.connector;
    }

    // Place content as file
    async file(content, location, user, target, permission) {
        console.log(chalk.keyword('coral')(`placing contents in ${location}}\n${content.substring(0, 50)}...`));

        let output;
        const conn = this.getConnector(target);

        const localTempPath = path.join(os.tmpdir(), uuidv4());
        let destTempPath;
        if (conn.type == 'local' && os.platform() == 'win32')
            destTempPath = path.join('/tmp', uuidv4());
        else
            destTempPath = path.posix.join('/tmp', uuidv4());

        try {
            // create the dest path's directories recursively if they don't exist
            if (conn.type == 'local')
                try { await fs.promises.mkdir(path.dirname(location), { recursive: true }); }
                catch (err) { if (err.code != 'EEXIST') { throw err } }
            else
                await this.run(`mkdir -p ${path.dirname(location)}`, user, undefined, target);

            await fs.promises.writeFile(localTempPath, content);
            await conn.scp(localTempPath, destTempPath);
            output = await conn.exec(`${this.sudoCMD(user, conn)} mv ${destTempPath} ${location}`);

            if (permission) {
                output = await conn.exec(`${this.sudoCMD(user, conn)} chmod ${permission} ${location}`);
            }

            await fs.promises.unlink(localTempPath);
        }
        catch (err) {
            output = { stdout: '', stderr: err, exitCode: 1 }
        }

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        return output;
    }

    // Patch file with diff
    async edit(diff, location, user, target, permission) {
        console.log(chalk.keyword('coral')(`edit contents in ${location}} with:\n${diff.substring(0, 50)}...`));

        let output;
        const conn = this.getConnector(target);

        const localTempPath = path.join(os.tmpdir(), uuidv4());
        const destTempPath = path.join('/tmp', uuidv4());

        try {
            if( !conn.pathExists(location) )
            {
                output = { stdout: '', stderr: `${location} does not exist.`, exitCode: 1 }
            }
            else
            {
                // Patch temp dir for windows
                if( conn.type == 'local' && require('os').platform() == 'win32' && location.indexOf("/tmp") == 0 )
                {
                    location = path.resolve(location.replace("/tmp", os.tmpdir()));
                }
                // Copy target to temporary location.
                await conn.scp(location, localTempPath);
                // Read content
                let content = await fs.promises.readFile(localTempPath);
                // Patch.
                let result = require('diff').applyPatch(content.toString(), diff);
                if( result == false )
                {
                    output = {stdout:'', stderr:'Could not apply patch', exitCode: 1}
                }
                else
                {
                    await fs.promises.writeFile(localTempPath, result);
                    // Copy patch to target machine.
                    await conn.scp(localTempPath, destTempPath);
                    // // Rename target file.
                    output = await conn.exec(`${this.sudoCMD(user, conn)} mv ${destTempPath} ${location}`);
                }
            }

            if (permission) {
                output = await conn.exec(`${this.sudoCMD(user, conn)} chmod +${permission} ${location}`);
            }

            // Remove our copy.
            await fs.promises.unlink(localTempPath);
        }
        catch (err) {
            output = { stdout: '', stderr: err, exitCode: 1 }
        }

        // if (output.exitCode != 0) {
        //     throw (output.stderr);
        // }
        return output;
    }


    // Long running command...
    // TODO: add spawnPersistent?
    async running(cmd, user, persistent, target)
    {
        let conn = this.getConnector(target);

        console.log(chalk`{rgb(255,136,0) running background command...}\n${cmd}`);
        let results = await conn.spawn(`${this.sudoCMD(user, conn)} ${cmd}`, {cwd: this.cwd});
        if( results.pid )
        {
            console.log( `Spawned pid: ${results.pid}`);
            this.spawnedPids.push( results.pid );
        }
        // // Need time to let background commands be ready for follow-on commands.
        await this.sleep(500);
    }

    // async stream(cell, onProgress, target) 
    // {
    //     return await this._run(cell, onProgress, target);
    // }

    // Simple command
    async run(cell, onProgress, target)
    {
        return await this._run(cell, onProgress, target)
    }
    

    _runInShell(cmd, shell)
    {
        if( shell === "powershell" )
        {
            return `powershell.exe ${cmd}`;
        }
        return cmd;
    }

    _privileged(cmd, onProgress) {
        let self = this;
        return new Promise(function(resolve, reject)
        {
            let sudo = require('./sudo-prompt');

            sudo.stdout_events.on('data', function(data)
            {
                if( onProgress ) { onProgress(data); }
                // console.log(data);
            });
    
            sudo.stderr_events.on('data', function(data)
            {
                if( onProgress ) { onProgress(data); }
                // console.log(data);
            });

            sudo.exec(cmd, {name: 'Docable privileged command', cwd: self.cwd}, function (err, stdout, stderr)
            {
                if( err && err.message )
                { 
                    console.log( err.message );
                    resolve({exitCode: 1, stdout:"", stderr: err.message });
                }
                else 
                {
                    resolve ({
                        exitCode: 0,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
            });
        });        
    }

    async _run(cell, onProgress, target)
    {
        let cmd = cell.content;
        let {user, persistent, privileged, shell, stream} = cell;

        let conn = this.getConnector(target);

        console.log(chalk.keyword('cornflowerblue')(`$ ${cmd}`));
        let output;

        if( shell )
            cmd = this._runInShell(cmd, shell);


        if( privileged && conn.type == 'local')
        { 
            try{
                output = await this._privileged(cmd, onProgress);
            } catch (err) {
                output = {exitCode: 1, stderr: `docable: ${err.message}`, stdout: ""}
            }
        }
        else if( stream ) {
            output = await conn.stream( `${this.sudoCMD(user, conn)} ` + cmd, onProgress );
        }
        else if (persistent) {
            output = await conn.execPersistent(`${this.sudoCMD(user, conn)} ` + cmd, persistent);
        }
        else { output = await conn.exec(`${this.sudoCMD(user, conn)} ` + cmd); }

        return output;
    }


    // TODO need to associate pids with targets/connector.
    async tearDown(targets)
    {
        //let conn = this.getConnector(targets);
        if( this.spawnedPids.length > 0 )
        {
            console.log(chalk`{rgb(255,136,0) Tearing down background commands with pids: ${this.spawnedPids.join(',')}}`);
            for( let pid of this.spawnedPids )
            {
                await this.connector.exec(`kill -9 ${pid}`);
            }
        }
    }

    sudoCMD(user, conn) {

        if (user) // && conn.sshConfig && conn.sshConfig.user != user)
            return `sudo -u ${user}`;
        else
            return '';
    }
}

module.exports = Operators;

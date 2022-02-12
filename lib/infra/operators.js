const chalk = require('chalk');
const path  = require('path');
const os    = require('os');
const fs = require('fs');
const child_process = require('child_process');
const { v4: uuidv4 } = require('uuid');
const slash = require('slash');

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

    _patchHome(location)
    {
        if( location.startsWith("~/") )
        {
            location = location.replace("~", os.homedir());            
        }
        return location;        
    }

    _patchLocationPath(conn, location)
    {
        let old = location;
        // Patch temp dir for windows
        if( conn.type == 'local' && os.platform() == 'win32' && location.indexOf("/tmp") == 0 )
        {
            location = path.resolve(location.replace("/tmp", os.tmpdir()));
        }

        if (conn.type == 'local')
            location = this._patchHome(location);

        if( !path.isAbsolute(location) && !location.startsWith('~/') )
        {
            // relative paths should respect cwd.
            location = path.join(this.cwd, location);
        }

        if (conn.type != 'local' || os.platform != 'win32')
            location = slash(location);

        console.log(`location: ${old} => patched as ${location}`);
        console.log(`cwd: ${this.cwd}`);
        return location;
    }

    // Place content as file
    async file(content, location, user, target, permission, mode) {
        console.log(chalk.keyword('coral')(`placing contents in ${location}\n${content.substring(0, 50)}...`));

        let output;
        const conn = this.getConnector(target);

        try {

            location = this._patchLocationPath( conn, location );

            // create the dest path's directories recursively if they don't exist
            if( path.dirname(location) != "" && !fs.existsSync(path.dirname(location)) )
            {
                if (conn.type == 'local')
                {
                    try { await fs.promises.mkdir(path.dirname(location), { recursive: true }); }
                    catch (err) { if (err.code != 'EEXIST') { throw Error(err.message) } }
                }
                else
                {
                    let result = await conn.exec(`${this.sudoCMD(user, conn)} mkdir -p ${path.dirname(location)}`);
                    if( result.exitCode != 0 )
                        return result;
                }
            }

            let destTempPath = await conn.writeTempFile("docable-file", content);
            // await fs.promises.writeFile(localTempPath, content);
            // let res = await conn.scp(localTempPath, destTempPath);
            // console.log( `destTempPath: ${destTempPath}` );

            if(conn.type == 'local') {
                try { 
                    if( mode == "append" ) {
                        await fs.promises.appendFile( location, content );
                    } else {
                        await fs.promises.rename(destTempPath, location);
                    }
                    output = { exitCode: 0, stderr: '', stdout: '' };
                }
                catch (err) { 
                    output = { exitCode: 1, stderr: err.message, stdout: '' };
                }
            }
            else
            {
                if( mode == "append" ) {
                    output = await conn.exec(`echo ${destTempPath} | ${this.sudoCMD(user, conn)} tee -a ${location}`);
                } else {
                    output = await conn.exec(`${this.sudoCMD(user, conn)} mv ${destTempPath} ${location}`);
                }
            }

            if (permission) {
                output = await conn.exec(`${this.sudoCMD(user, conn)} chmod ${permission} ${location}`);
            }
        }
        catch (err) {
            output = { stdout: '', stderr: err.message, exitCode: 1 }
        }

        if (output.exitCode != 0) {
            throw (output.stderr);
        }
        return output;
    }

    async copy(cell, hostCwd, target)
    {
        let result;
        const conn = this.getConnector(target);

        let content = cell.content.split(/\s+/);
        if( content.length != 3 || content[0] != "COPY")
        {
            result = {exitCode: 1, stderr: "Usage: COPY src dest", stdout: ""};
            return result; 
        }

        let src = content[1];
        let dest = content[2];

        // expand ~
        src = this._patchHome(src);

        if( !path.isAbsolute(src) )
        {
            // relative paths should respect cwd.
            src = path.join(hostCwd, src);
        }

        console.log(chalk.keyword('coral')(`COPY ${src} to ${dest}`));

        result = await conn.scp(src, dest);
        return result;
    }

    // Patch file with diff
    async edit(diff, location, user, target, permission) {
        console.log(chalk.keyword('coral')(`edit contents in ${location}} with:\n${diff.substring(0, 50)}...`));

        let output;
        const conn = this.getConnector(target);

        const localTempPath = path.join(os.tmpdir(), uuidv4());
        let destTempPath;
        if (conn.type == 'local' && os.platform() == 'win32')
            destTempPath = path.join('/tmp', uuidv4());
        else
            destTempPath = path.posix.join('/tmp', uuidv4());

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
                // Read content
                let content = await conn.readFile( location );
                console.log( content );
                // Patch.
                let result = require('diff').applyPatch(content, diff);
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
            console.log(err.message);
            output = { stdout: '', stderr: err.message, exitCode: 1 }
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
    async run(cell, onProgress, target, stdioStreams)
    {
        return await this._run(cell, onProgress, target, stdioStreams);
    }
    

    async _cmdAsBashScript(conn, cmd)
    {
        let scriptPath = await conn.writeTempFile("docable.sh", 
`
#!/bin/bash

HISTFILE=~/.bash_history
set -o history
history -a
${cmd}
`        
        );
        if( conn.type == "local" )
        {
            if( os.platform() == 'win32' )
            {
                scriptPath = scriptPath.replace(/\\/g, "/");
            }
            await fs.promises.chmod(scriptPath, 0o700);
        }
        else
        {
            let result = await conn.exec(`chmod +x "${scriptPath}"`);
            // console.log( result );
        }
        return scriptPath;
    }

    async _runInShell(conn, cmd, shell)
    {
        if( shell === "powershell" )
        {
            let scriptPath = path.join(os.tmpdir(), uuidv4() + ".ps1" );
            await fs.promises.writeFile( scriptPath,
`
${cmd}
`);
            await fs.promises.chmod(scriptPath, 0o700);
            // let powerCmd = `powershell "& ""${scriptPath}"""`;
            let powerCmd = `powershell -File ${scriptPath}`
            // return {updatedCmd: `powershell.exe ${cmd}`};
            return {updatedCmd: powerCmd, scriptPath: scriptPath};
        }
        if( shell === "bash" )
        {
            let scriptPath = await this._cmdAsBashScript(conn, cmd);
            console.log(`Running in bash shell: ${scriptPath}`);
            let bashCmd = `bash -c "${scriptPath}"`;
            return {updatedCmd: bashCmd, scriptPath: scriptPath};
        }

        return {updatedCmd: cmd};
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

    async _run(cell, onProgress, target, stdioStreams)
    {
        let cmd = cell.content;
        let {user, persistent, privileged, shell, stream, serve, spawn, tty} = cell;

        let conn = this.getConnector(target);

        // Allow cell to set it's own cwd
        let __cwd = this.cwd;
        console.log( this.cwd );

        if( (cell.type == 'command' || cell.type == 'file') && cell.path )
        {
            let cwd = cell.path;
            // relative paths should respect cwd.
            if( !cell.path.startsWith('~/') && !path.isAbsolute(cell.path) )
            {
                cwd = path.join(this.cwd, cell.path);
            }

            console.log( cwd );

            this.cwd = cwd;
            conn.setCWD( cwd );
        }


        console.log(chalk.keyword('cornflowerblue')(`$ ${cmd}`));
        let output;
        let cleanup;

        if( shell )
        {
            let {updatedCmd, scriptPath} = await this._runInShell(conn, cmd, shell);
            cmd = updatedCmd;
            cleanup = scriptPath;

            console.log( cmd );
        }
        else if ( cell.interactive && conn.type == "local" )
        {
            // Allow command to be run in new interactive terminal
            if( os.platform() == 'win32' )
            {
                cmd = `start Cmd.exe /K "${cmd}"`;
            }
            else if (os.platform() == 'darwin' )
            {
                let scriptPath = await this._cmdAsBashScript(conn, cmd);
                cmd = `open -a Terminal.app "${scriptPath}"`;
            }
        }

        if( privileged && conn.type == 'local')
        { 
            try{
                output = await this._privileged(cmd, onProgress);
            } catch (err) {
                output = {exitCode: 1, stderr: `docable: ${err.message}`, stdout: ""}
            }
        }
        else if( stream || serve ) {
            output = await conn.stream( `${this.sudoCMD(user, conn)} ` + cmd, onProgress, {getPid: true} );
        }
        else if (persistent) {
            output = await conn.execPersistent(`${this.sudoCMD(user, conn)} ` + cmd, persistent);
        }
        else if (spawn) {
            let results = await conn.spawn(`${this.sudoCMD(user, conn)} ${cmd}`, {cwd: this.cwd});
            if( results.pid )
            {
                console.log( `Spawned pid: ${results.pid}`);
                this.spawnedPids.push( results.pid );

                output = {exitCode: 0, stderr: '', stdout: "Successfully started background command..."}
            }
            else output = {exitCode: 1, stderr: `docable: failed to spawn command`, stdout: ""}
            // // Need time to let background commands be ready for follow-on commands.
            await this.sleep(500);
        }
        else { 
            let options = { stdioStreams, tty: true };
            if( tty ) options.tty = true;
            output = await conn.exec(`${this.sudoCMD(user, conn)} ` + cmd, options ); 
        }

        if( cleanup && !spawn && conn.type == "local")
        {
            try {
                await fs.promises.unlink(cleanup);
            }catch(e) {console.log(e);}
        }

        // Restore cwd
        this.cwd = __cwd;
        conn.setCWD(__cwd);

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

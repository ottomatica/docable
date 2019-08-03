const chalk = require('chalk');

class Transform {
    constructor() 
    {
    }

    // Trim prompt symbol from single line cmd text
    _trimPrompt(cmd)
    {
        let contains$ = cmd.indexOf("$");
        if( contains$ > -1 && cmd.substr(contains$).match(/^[a-zA-Z0-9 ]*$/))
        {
            cmd = cmd.substr(contains$+1).trimLeft();
        }
        return cmd;
    }

    // Trim prompts from single or multiple-line commands.
    trimPrompt(cmd)
    {
        let trimmed = [];
        for (let line of cmd.split(/\r?\n/) )
        {
            trimmed.push( this._trimPrompt(line) );
        }
        return trimmed.join('\n');
    }

    // Extract a command and its expected output
    commandExpects(multiLineText)
    {
        let lines = multiLineText.split('\n');
        // if( lines.length == 1 )
        // {
        //     throw new Error("Expected multiline command text")
        // }
        let cmd = lines[0].trimRight();
        lines.splice(0,1);
        let expect = lines.join('\n').trimRight();

        return {cmd, expect};
    }
    
}

module.exports = Transform;
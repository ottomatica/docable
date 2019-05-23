const chalk = require('chalk');

class Transform {
    constructor() 
    {
    }

    // Trim prompt symbol from single line cmd text
    trimPrompt(cmd)
    {
        let contains$ = cmd.indexOf("$");
        if( contains$ > -1 )
        {
            cmd = cmd.substr(contains$+1).trimLeft();
        }
        return cmd;
    }

    // Extract a command and its expected output
    commandExpects(multiLineText)
    {
        let lines = multiLineText.split('\n');
        if( lines.length == 1 )
        {
            throw new Error("Expected multiline command text")
        }
        let cmd = lines[0].trimRight();
        lines.splice(0,1);
        let expect = lines.join('\n').trimRight();

        return {cmd, expect};
    }
    
}

module.exports = Transform;
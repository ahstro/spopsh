// Whoo! Welcome to spopsh's source code!! ❤ ahstro \\

// TODO:
// Re-render last command on resize
// Add config to set order of songs/index/time etc. on qls/ls, custom prompt
// Improve colors (theme vs direct)
// Make ^C clear line
// Make ^D exit
// "Random" crashses might be because telnet doesn't output JSON, e.g. 'bye' outputs 'Bye bye!'

var telnet = new require('telnet-client')();

var colors = require('colors');
colors.setTheme({
    help: ['magenta', 'bold'],
    info: ['blue', 'bold'],
    error: 'red',
    win: 'green'
});

var rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.setPrompt('❤ '.red);
rl.on('line', function(cmd) {
    rl.pause();
    execute(cmd);
});

telnet.on('ready', function() {
    console.log("Welcome to spopsh!\nType 'help' for a list of commands");
    var args = process.argv.splice(2).join(' ');
    getCommand(args);
});

telnet.on('error', function() {
    console.log("Fatal error! Your spop daemon might not be running.");
    process.exit(5);
});

telnet.on('close', function() {
    process.exit();
});

// TODO: Add to separate file?
var customCommands = [
    {
        name: 'about',
        args: '',
        summary: 'information about spopsh and spop'
    },
    {
        name: 'clear',
        args: '',
        summary: 'clears the screen, same as ctrl+l'
    }
];

function getPlaylist(json, i) {
    var name = json.name || '★';
    var index = json.index || i; // Can't get json if offline; i should be same
    index = index < 10 ? '0' + index : index;
    index += ' ';
    var offline = ' [' + (json.offline ? '✓': '✕') + ']';
    var spacer = getSpacer([index, name], [offline]);
    // Setting color in the original declaration of 'offline'
    // messes with the .length property used by getSpacer()
    offline = offline.replace(/[✓✕]/, function(p1) {
        return p1 === '✓' ? '✓'.win : '✕'.error;
    });
    return '\n' + index.info + (name === '★' ? name.yellow : name) + spacer + offline;
}

function getTrack(json) {
    var index = (json.index < 10 ? '0' + json.index : json.index.toString());
    var song = ' ' + json.artist + ' - ' + json.title;
    var album = ' [' + json.album + '] ';
    var time = getTime(json.duration);
    var spacer = getSpacer([index, song], [album, time]);

    // Grey out song if not available (offline doesn't grey. bug in spop?)
    if(json.available) {
        return '\n' + index.info + song + spacer + album + time.yellow;
    } else {
        return '\n' + index.grey + song.grey + spacer + album + time.grey;
    }
}

function getSpacer(leftArr, rightArr) {
    var leftLength = 0;
    for(var i = 0; i < leftArr.length; i++) {
        leftLength += leftArr[i].length;
    }
    var rightLength = 0;
    for(var i = 0; i < rightArr.length; i++) {
        rightLength += rightArr[i].length;
    }
    var spacerLength = (process.stdout.columns - (leftLength + rightLength));
    var spacer = '';
    for(var j = 0; j < spacerLength; j++) spacer += ' ';
    return spacer;
}

function getTime(duration) {
    var minutes = Math.floor((duration / 1000) / 60);
    var seconds = Math.floor((duration / 1000) % 60);
        seconds = seconds < 10 ? '0' + seconds : seconds;
    return minutes + ':' + seconds;
}

function parse(cmd, json) {
    cmd = cmd.split(' ');
    var output = '';
    switch(cmd[0]) {
        case 'help':
            if(cmd[1]) {
                output += "'help' doesn't take arguments";
                break;
            }
            output += "Available commands:".help;
            for(var i = 0; i < json.commands.length; i++) {
                var name = json.commands[i].command;
                var args = '';
                json.commands[i].args.forEach(function(arg) {
                    args += ' [' + arg.blue + ']';
                });
                var summary = json.commands[i].summary;

                output += '\n' + name.info + args + '\n  ' + summary;
            }
            for(var i = 0; i < customCommands.length; i++) {
                output += '\n' + customCommands[i].name.info + customCommands[i].args + '\n  ' + customCommands[i].summary;
            }
            break;

        case 'ls':
            if(!cmd[1]) {
                // TODO: Add argument support
                output += "Playlists:".help;
                for(var i = 0; i < json.playlists.length; i++) {
                    output += getPlaylist(json.playlists[i], i);
                }
            } else if (!isNaN(cmd[1]) && !cmd[2]) {
                output += "Tracks:".help;
                for(var i = 0; i < json.tracks.length; i++) {
                    output += getTrack(json.tracks[i], i);
                }
            } else {
                output += "'ls' doesn't take that many arguments";
                // TODO: Add ability to search for playlist names
            }

            break;

        case 'next':
        case 'prev':
        //TODO: Make sure these make sense
        case 'qclear':
        case 'stop':
        case 'status':
        case 'notify':
        case 'repeat':
        case 'shuffle':
        case 'toggle':
        case 'play':
            var stat, song;
            if(json.status === 'playing' || json.status === 'paused' ) {
                stat = json.status === 'playing' ? '♪' + ' Playing: ' :  '▮▮' + ' Paused: ';
                song = json.artist  + ' - ' + json.title + ' - ' + json.album;
            } else {
                stat = '■' + ' Stopped';
                song = '';
            }
            var shuffle = ' Shuffle: ' + (json.shuffle ? '↝' : '→');
            var repeat = ' Repeat: ' + (json.repeat ? '↺' : '→');
            var track = ' Track: ' + (json.current_track || 'X') + '/' + json.total_tracks;
            var progress = ' ' + getTime(json.position * 1000) + '/' + getTime(json.duration);
            var spacer = getSpacer([stat, song], [repeat, shuffle, track, progress]);
            stat = stat.replace(/[♪▮■]/g, function(p1) {
                if(p1 === '♪') {
                    return '♪'.win;
                } else if (p1 === '▮') {
                    return '▮'.yellow;
                } else if (p1 === '■'){
                    return '■'.error;
                }
            });
            output += stat + song + spacer + repeat + shuffle + track + progress + '\n';
            for(var i = 0; i < process.stdout.columns; i++) {
                output += i < (json.position / (json.duration / 1000)) * process.stdout.columns ? '='.blue : '-'.info;
            }
            break;

        // TODO
        // TODO: Currently playing?
        case 'qls':
            output += "Queue:".help;
            for(var i = 0; i < json.tracks.length; i++) {
                output += getTrack(json.tracks[i]);
            }
            break;

        case 'qrm':
        case 'add':
        case 'seek':
        case 'goto':
        case 'offline-status':
        case 'offline-toggle':
        case 'image':
        case 'uinfo':
        case 'uadd':
        case 'uplay':
        case 'uimage':
        case 'search':
        case 'bye':
        case 'quit':
        case 'idle':
            output = json;
            break;

        case 'about':
            output = "spopsh is pretty much a prettifier of spop's telnet interface.\nYou can check out the spopsh's source code at https://github.com/ahstro/spopsh and spop over at https://github.com/Schnouki/spop\n  ❤ ahstro";
            break;

        // TODO: Add monitor command to show status dynamically

        case '':
            // Stops 'Invalid command!' output for custom command
            return;

        default:
            output = 'Invalid command!'.error + "\nTry the 'help' command for a list of available commands";
    }

    console.log(output);
}

function alias(cmd) {
    // Aliases
    // TODO: Add to 'help' somehow
    switch(cmd) {
        case 's':
            return 'status';

        case 'b':
        case 'q':
        case 'e':
        case 'exit':
            return 'bye';

        case 'n':
            return 'next';

        case 'p':
        case 'previous':
            return 'prev';

        case 'dir':
        case 'list':
        case 'playlists':
            return 'ls';

        case 'clear':
            rl.write(null, {ctrl: true, name: 'l'});
            return '';

        default:
            return cmd;
    }
}

function execute(cmd) {
    cmd = alias(cmd);

    telnet.exec(cmd, { echoLines: -1 }, function(res) {
        // TODO: Add subcommands, e.g. 'help notify' to bring up help on just notify command
        //cmd = cmd.split(' ');

        // TODO: Fix hack
        // Might be unnecessary
        if(cmd === 'bye' || cmd === 'quit') process.exit();

        try {
            var json = JSON.parse(res);
            parse(cmd, json);
        } catch (e) {
            // TODO
            console.log(e);
        } finally {
            getCommand();
        }
    });
}

function getCommand(arg) {
    if(arg) execute(arg);
    rl.prompt();
    rl.resume();
}

telnet.connect({
    host: '127.0.0.1',
    port: 6602,
    irs: '\n',
    shellPrompt: '\n',
    timeout: 0
});

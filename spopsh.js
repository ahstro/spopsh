// Whoo! Welcome to spopsh's source code!! ❤ ahstro \\

// TODO:
// Refactor all render code into separate functions
// Merge promptForInput() into execute()
// Add external ip support
// Align title, title, album, etc.
// Index length (01 if 10+, 001 if 100+, etc.)
// Major refactoring
// Read a style guide
// Re-render last command on resize
// Add config to set order of songs/index/time etc. on qls/ls, custom prompt
// Improve colors (theme vs direct)
// Make ^C clear line
// Make ^D exit
// "Random" crashses might be because telnet doesn't output JSON,
//  e.g. 'bye' outputs 'Bye bye!'
// Add json mode, e.g. if process.argv[2] is --json, don't prettify anything

var Telnet = require('telnet-client');
var telnet = new Telnet();

var colors = require('colors');
colors.setTheme({
  help: ['bold', 'magenta'],
  info: ['bold', 'blue']
});

var rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
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

function getSpacer(leftArr, rightArr) {
  var leftLength = 0;

  for(var i = 0; i < leftArr.length; i++) {
    leftLength += leftArr[i].length;
  }

  var rightLength = 0;

  for(i = 0; i < rightArr.length; i++) {
    rightLength += rightArr[i].length;
  }

  var spacerLength = (process.stdout.columns - (leftLength + rightLength));
  var spacer = '';

  for(var j = 0; j < spacerLength; j++) {
    spacer += ' ';
  }

  return spacer;
}

function getPlaylist(json, i) {
  var name    = json.name || '★';
  var index   = json.index || i; // Can't get json if offline; i should be same
      index   = index < 10 ? '0' + index : index;
      index  += ' ';
  var offline = ' [' + (json.offline ? '✓' : '✕') + ']';
  var spacer  = getSpacer([index, name], [offline]);

  // Setting color in the original declaration of 'offline'
  // messes with the .length property used by getSpacer()
  offline = offline.replace(/[✓✕]/, function(p1) {
    return p1 === '✓' ? '✓'.green : '✕'.red;
  });

  return '\n' + index.info + (name === '★' ? name.yellow : name) + spacer
    + offline;
}

function getTime(duration) {
  var minutes = Math.floor((duration / 1000) / 60);
  var seconds = Math.floor((duration / 1000) % 60);
      seconds = seconds < 10 ? '0' + seconds : seconds;

  return minutes + ':' + seconds;
}

function getTrack(json) {
  var song   = ' ' + json.artist + ' - ' + json.title;
  var time   = getTime(json.duration);
  var index  = (json.index < 10 ? '0' + json.index : json.index.toString());
  var album  = ' [' + json.album + '] ';
  var spacer = getSpacer([index, song], [album, time]);

  // Grey out song if not available (offline doesn't grey. bug in spop?)
  if(json.available) {
    return '\n' + index.info + song + spacer + album + time.yellow;
  } else {
    return '\n' + index.grey + song.grey + spacer + album + time.grey;
  }
}

function render(cmd, json) {
  var output = '';
      cmd    = cmd.split(' ');

  switch(cmd[0]) {

    case 'help':
      if(cmd[1]) {
        output += "'help' doesn't take arguments";
        break;
      }

      output += "Available commands:".help;

      for(var i = 0; i < json.commands.length; i++) {
        var summary = json.commands[i].summary;
        var name    = json.commands[i].command;
        var args    = json.commands[i].args.map(function(arg) {
          return ' [' + arg.blue + ']';
        }).join('');

        output += '\n' + name.info + args + '\n  ' + summary;
      }

      for(i = 0; i < customCommands.length; i++) {
        output += '\n' + customCommands[i].name.info +
                         customCommands[i].args + '\n  ' +
                         customCommands[i].summary;
      }

      break;


    case 'ls':
      if(!cmd[1]) {
        // TODO: Add argument support
        output += "Playlists:".help;

        for(var i = 0; i < json.playlists.length; i++) {
          output += getPlaylist(json.playlists[i], i);
        }

      } else if(!isNaN(cmd[1]) && !cmd[2]) {
        output += "Tracks:".help;

        for(var i = 0; i < json.tracks.length; i++) {
          output += getTrack(json.tracks[i], i);
        }

      } else {
        output += "'ls' doesn't take that many arguments";
        // TODO: Add ability to search for playlist names
      }

      break;


    //TODO: Make sure these make sense
    case 'shuffle':
    case  'status':
    case  'notify':
    case  'repeat':
    case  'toggle':
    case  'qclear':
    case    'goto':
    case    'next':
    case    'prev':
    case    'stop':
    case    'play':
      var stat, song;

      if(json.status === 'playing' || json.status === 'paused' ) {
        stat = json.status === 'playing' ? '♪ Playing: ' : '▮▮ Paused: ';
        song = json.artist + ' - ' + json.title + ' - ' + json.album;
      } else {
        stat = '■' + ' Stopped';
        song = '';
      }

      var progress = json.position ? ' ' + getTime(json.position * 1000) + '/' +
                                           getTime(json.duration) : '';
      var shuffle  = ' Shuffle: '  + (json.shuffle ? '↝' : '→');
      var repeat   = ' Repeat: '   + (json.repeat ? '↺' : '→');
      var track    = ' Track: '    + (json.current_track || 'X') + '/' +
                                     (json.total_tracks);
      var spacer   = getSpacer([stat, song],
                               [repeat, shuffle, track, progress]);

      // This needs to be below the declaration of spacer,
      // because the colors mess up string length
      stat = stat.replace(/[♪▮■]/g, function(p1) {
        switch(p1) {
          case '♪':
            return '♪'.green;
          case '▮':
            return '▮'.yellow;
          case '■':
            return '■'.red;
        }
      });

      output += stat + song + spacer + repeat + shuffle + track + progress + '\n';

      for(var i = 0; i < process.stdout.columns; i++) {
        progress = json.position / (json.duration / 1000);
        output  += i < progress * process.stdout.columns ? '='.blue : '-'.info;
      }

      break;


      // TODO
      // TODO: Currently playing? Add feature upstream?
    case 'qls':
      output += "Queue:".help;
      for(var i = 0; i < json.tracks.length; i++) {
        output += getTrack(json.tracks[i]);
      }
      break;


    case 'qrm':
      // TODO: Say which song was removed. Add feature upstream?
      if(!cmd[1]) {
        output = "'qrm' takes at least one argument.";
      } else if(!cmd[2]) {
        output = 'Removed song number ' + cmd[1].info + ' from the queue.';
      } else if(!cmd[3]) {
        output = 'Removed songs ' + cmd[1].info + ' through ' +
                                    cmd[2].info + ' from the queue.';
      } else {
        output = "'qrm' doesn't take that many arguments.";
      }
      break;


    case 'add':
      // TODO: Name of playlist. Add feature upstream?
      if(!cmd[1]) {
        output = "'add' takes at least one argument.";
      } else if(!cmd[2]) {
        output = 'Added playlist number ' + cmd[1].info + ' to the queue.';
      } else if(!cmd[3]) {
        output = 'Added song ' + cmd[1].info + ' from playlist number ' +
                                 cmd[2].info + ' to the queue.';
      } else {
        output = "'qrm' doesn't take that many arguments.";
      }
      break;


    case 'seek':
      // TODO: Allow seeking with min:sec instead of millisecs
      if(!cmd[1]) {
        output = "'seek' takes an argument.";
      } else if(!cmd[2]) {
        render('status', json);
      } else {
        output = "'seek' doesn't take that many arguments.";
      }
      break;


    case 'image':
      if(json.status === 'ok') {
        // TODO: require('fs') and 'opener', save and open
        output += 'Trying to show the cover image with your default image viewer';
        output += json.data;
        //opener(json.data);
      } else {
        output += 'Something went wrong.';
      }
      output = json;
      break;


    case 'uinfo':
      if(!cmd[1]) {
        output += "'uinfo' takes an argument.";
      } else if(!cmd[2]) {
        switch(json.type) {
          case 'track':
            var duration = getTime(json.duration);
            var artist   = 'Artist: ';
            var title    = ' Song: ';
            var album    = ' Album: ';
            var spacer   = getSpacer([artist, json.artist,
                                      title,  json.title,
                                      album,  json.album], 
                                     [duration]);
            output += artist.info + json.artist + title.info + json.title +
                      album.info  + json.album  + spacer     + duration.yellow;
            break;

          case 'playlist':
            // TODO
            output = json;
            break;

          case 'album':
            // TODO
            output = json;
            break;
        }
      } else {
        output += "'uinfo' doesn't take that many arguments.";
      }
      break;


    case 'search':
      output += 'Search results for '.info + json.query.blue;

      output += '\n\n' + json.total_tracks.toString().info + ' total tracks:';
      for(var i = 0; i < json.tracks.length; i++) {
        output += getTrack(json.tracks[i]);
      }

      output += '\n\n' + json.total_albums.toString().info + ' total albums:';
      for(i = 0; i < json.albums.length; i++) {
        var index = i < 10 ? '0' + i : i.toString();
        output += '\n' + index.info + ' ' + json.albums[i].artist + ' - ' +
                                            json.albums[i].title;
      }

      output += '\n\n' + json.total_artists.toString().info + ' total artists:';
      for(i = 0; i < json.artists.length; i++) {
        index = i < 10 ? '0' + i : i.toString();
        output += '\n' + index.info + ' ' + json.artists[i].artist;
      }

      output += '\n\n' + json.total_playlists.toString().info + ' total playlists:';
      for(i = 0; i < json.playlists.length; i++) {
        output += getPlaylist(json.playlists[i], i);
      }

      break;


    case 'offline-status':
      output += 'You have ' + json.offline_playlists.toString().info + ' offline playlist';
      if(json.offline_playlists !== 1) output += 's';
      output += ", which you can view using the 'ls' command";

      if(json.tracks_to_sync > 0) {
        output += '\nYou have ' + json.tracks_to_sync.toString().info + ' track';
        if(json.tracks_to_sync !== 1) output += 's';
        output += ' left to sync.';
      }

      if(json.sync_in_progress) {

        output += '\nCurrently syncing ' + json.tracks_queued.toString().info + ' track';
        if(json.tracks_queued !== 1) output += 's';

        output += '\n' + json.tracks_copied.toString().info + ' track';
        if(json.tracks_copied !== 1) output += 's';
        output += ' has finished syncing.';

        if(json.tracks_error > 0) {
          output += '\nAn error occured while syncing ' + json.tracks_error.toString().info +
                    ' track';
          if(json.tracks_error !== 1) output += 's';
        }

        if(json.tracks_willnotcopy > 0) {
          output += '\n' + json.tracks_error.toString().info +
                    ' track';
          if(json.tracks_willnotcopy !== 1) output += 's';
          output += ' will not be synced.';
        }

      }

      // Calculate time left before relogin is needed.
      // spopd supplies the time in seconds, so daysa and hours
      // are calculated by dividing the number by 60 (sec in min),
      // 60 (min in hour), and 24 (hour in day).
      var days  = Math.floor(json.time_before_relogin / 86400);
      var hours = Math.floor((json.time_before_relogin % 86400) / 3600);
      output += '\nYou need to log in again in ' + days.toString().info + ' day';
      if(days !== 1) output += 's';
      output += ' and ' + hours.toString().info + ' hour';
      if(hours !== 1) output += 's';
      output += '.';

      break;

    case 'offline-toggle':
      //TODO: Show name of toggled playlist. Add feature upstream?
      if(!cmd[1]) {
        output += "'offline-toggle' takes a playlist number as an argument";
      } else if(cmd[1] && !cmd[2]) {
        output += 'The playlist you selected ';
        if(json.offline) {
          output += "should now be syncing and will be available offline soon. " +
            "Check the status using the 'offline-status'-command";
        } else {
          output += 'will no longer be available for offline listening ' +
            'and the cached tracks have been removed.';
        }
      } else {
        output += "'offline-toggle' doesn't take that many arguments.";
      }
      break;

    case         'uimage':
    case          'uplay':
    case           'uadd':
    case           'idle':
      output = json;
      break;

    case 'about':
      output = "spopsh is pretty much a prettifier of spop's telnet interface." +
               "\nYou can check out the spopsh's source code at " +
               "https://github.com/ahstro/spopsh and spop over at " +
               "https://github.com/Schnouki/spop\n  ❤ ahstro";
      break;

      // TODO: Add monitor command to show status dynamically

    case '':
      // Stops 'Invalid command!' output for custom command, e.g. clear
      // For the record, has nothing to do with 'Enter' to toggle playback
      return;

    default:
      output = "Invalid command!".red +
               "\nTry the 'help' command for a list of available commands";
  }

  // Prevents extra line break on e.g. 'seek'
  if(output) {
    console.log(output);
  }
}

function alias(cmd) {
  // Aliases
  // TODO: Add to 'help' somehow
  switch(cmd) {
    case 's':
      return 'status';

    case 'pause':
    case      '': // Enter toggles playback
      return 'toggle';

    case 'exit':
    case    'b':
    case    'q':
    case    'e':
      return 'bye';

    case 'n':
      return 'next';

    case 'previous':
    case        'p':
      return 'prev';

    case 'playlists':
    case      'list':
    case       'dir':
      return 'ls';

    case 'offlinestatus':
    case            'os':
      return 'offline-status';

    case 'clear':
      rl.write(null, {
        ctrl: true,
        name: 'l'
      });
      return '';

    default:
      return cmd;
  }
}

// Presents the prompt set with rl.setPrompt and waits for user input,
// unless a command is passed as an argument
function promptForInput(input) {
  if(input) {
    execute(input);
  }
  rl.prompt();
  rl.resume();
}

// Send command to server and pass response to correct functions
function execute(cmd) {
    // Get the correct command to pass to the server
    cmd = alias(cmd);

    // TODO: Add subcommands, e.g. 'help notify'
    //cmd = cmd.split(' ');

    telnet.exec(cmd, { echoLines: -1 }, function(res) {
      // Server sends non-JSON strings on 'bye', so we won't try to parse it
      if(cmd !== 'bye') {
        try {
          // Parse the server response as JSON and render it accordingly
          var json = JSON.parse(res);
          render(cmd, json);
        } catch(e) {
          // Logs errors
          console.log(e);
        } finally {
          // Present the prompt when render is done
          promptForInput();
        }
      }
    });
}

// Sets the prompt that the user will see when input is expected
rl.setPrompt('❤ '.red);

// Runs when user presses enter after input
rl.on('line', function(cmd) {
  rl.pause();
  execute(cmd);
});

// Runs when the telnet connection is established
telnet.on('ready', function() {
  console.log("Welcome to spopsh!\nType 'help' for a list of commands");
  var args = process.argv.splice(2).join(' ');
  promptForInput(args);
});

// Runs when the telnet connection runs into an error
telnet.on('error', function() {
  console.log("Fatal error! Your spop daemon might not be running.");
  process.exit(5);
});

// Runs when the telnet connection is closed
telnet.on('close', function() {
  process.exit();
});

// Initialized the telnet connection to the server
telnet.connect({
  shellPrompt: '\n',
      timeout: 0,
         host: '127.0.0.1',
         port: 6602,
          irs: '\n'
});

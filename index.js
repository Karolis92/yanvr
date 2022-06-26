import child_process from 'child_process';
import findRemoveSync from 'find-remove';
import fs from 'fs';
import config from './config.json' assert {type: 'json'};

const { rootDir, rtspUrl, segmentTime } = config;
const recordingsDir = `${rootDir}/recordings`;

const hour = 60 * 60;
const day = hour * 24;
function toMs(s) {
  return s * 1000;
}

async function waitForDir() {
  while (!fs.existsSync(rootDir)) {
    console.log('waiting for directory to be mounted');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  console.log('directory is mounted');
  if (!fs.existsSync(recordingsDir)) {
    console.log('creating recordings dir');
    fs.mkdirSync(recordingsDir);
  }
}

function record() {
  const child = child_process.spawn(
    'ffmpeg',
    [
      '-use_wallclock_as_timestamps 1',
      '-rtsp_transport tcp',
      '-stimeout 1000000',
      `-i ${rtspUrl}`,
      '-strftime 1 ',
      '-c copy',
      '-f segment',
      `-segment_time ${segmentTime}`,
      '-reset_timestamps 1',
      `${recordingsDir}/%Y-%m-%d-%H-%M-%S.mkv`,
      // args for hls stream:
      // '-c copy -hls_time 10 -hls_list_size 10 -hls_flags delete_segments',
      // '-start_number 1 ./stream/mystream.m3u8'
    ],
    {
      shell: true,
      stdio: 'inherit',
    }
  );

  // stop ffmpeg:
  // setTimeout(() => child.stdin.write('q'), 10000);

  child.on('exit', (code) => {
    console.error('\x1b[41m%s\x1b[0m', `ffmpeg died (code: ${code}), restarting in 30s`);
    setTimeout(record, toMs(30));
  });
}

function cleanup() {
  setInterval(
    () => {
      try {
        findRemoveSync(recordingsDir, {
          age: { seconds: 10 * day },
          extensions: '.mkv'
        })
      } catch (e) {
        console.error('\x1b[41m%s\x1b[0m', 'failed to cleanup', e);
      }
    },
    toMs(hour)
  );
}

await waitForDir();
record();
cleanup();

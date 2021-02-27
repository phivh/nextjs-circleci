const util = require('util');
const fs = require('fs');
// const readline = require('readline');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec); 
const { existsSync } = fs;

const PREFIX = 100;

const main = async () => {
  try {
    const args = Object.values(process.argv);
    console.log('args:', args)
    const COMMIT_SHA = args[2];``
    const CIRCLE_PULL_REQUEST_URL = args[3];
    const SUDO_PASSWORD = args[4];
    if(!COMMIT_SHA) {
      throw new Error(`Missing entry value: COMMIT_SHA`);
    }
    if(!CIRCLE_PULL_REQUEST_URL) {
      throw new Error(`Missing entry value: CIRCLE_PULL_REQUEST`);
    }
    await exec('git fetch');
    await exec(`git checkout ${COMMIT_SHA}`);

    // parse CIRCLE_PULL_REQUEST
    const CIRCLE_PULL_REQUEST = CIRCLE_PULL_REQUEST_URL.split('/pull/')[1];
    // await exec(`sudo mkdir /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    if(!existsSync(`/var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`)) {
 
      await exec(`echo SUDO_PASSWORD | sudo -S mkdir /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      console.log('Created folder:', `${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    }
    await exec('npm run build');
    console.log('Build successful');
    await exec(`echo SUDO_PASSWORD | sudo -S cp /home/dominitech/test-circleci/package.json /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    await exec(`echo SUDO_PASSWORD | sudo -S cp /home/dominitech/test-circleci/.env /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    await exec(`echo SUDO_PASSWORD | sudo -S cp -r /home/dominitech/test-circleci/.next /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    await exec(`echo SUDO_PASSWORD | sudo -S cp -r /home/dominitech/test-circleci/node_modules /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    const _app_context = `{
      "apps" : [{
        "name": "testcircleci",
        "cwd": "/var/wwww/stage${CIRCLE_PULL_REQUEST}.testcircleci.com/",
        "script": "npm",
        "args": "start -p ${PREFIX}${CIRCLE_PULL_REQUEST}",
        "watch": true
      }]
    }`;
    fs.writeFile('./scripts/app.json', _app_context, 'utf8', function (err) {
      if (err) throw err;
      console.log('The file has been saved!');
    });

    await exec('pm2 start ./scripts/app.json');
    await exec('pm2 save');

    /// create virtual host
    const vh = `
      server {
        listen  80;

        server_name stage${CIRCLE_PULL_REQUEST}.testcircleci.com;

        location / {
                proxy_pass http://127.0.0.1:${PREFIX}${CIRCLE_PULL_REQUEST};
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP  $remote_addr;
                proxy_set_header X-Forwarded-For $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
        }
      }`;
      // fs.writeFile('./app.json', _app_context, 'utf8', function (err) {
      //   if (err) throw err;
      //   console.log('The file has been saved!');
      // });
      console.log('vh:',vh)
      await exec(`echo ${vh} | sudo tee -a stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      await exec(`echo ${vh} | sudo tee -a /etc/nginx/sites-available/stage${CIRCLE_PULL_REQUEST}.testcircleci.com > /dev/null`);
      await exec(`echo SUDO_PASSWORD | sudo -S systemctl restart nginx`);
      console.log('Deploy successful');
      await exec(`exit`);

  } catch (e) {
    throw new Error(e.message);
  }
}

main();
const util = require('util');
const fs = require('fs');
// const readline = require('readline');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec); 
const { existsSync } = fs;

const PREFIX = 100;
const SERVED_FOLDER = '/home/dominitech/workspace/test-circleci';
const ECOSYTEM_FILE = 'scripts/ecosystem.config.js';

const main = async () => {
  try {
    const args = Object.values(process.argv);
    console.log('args:', args)
    const COMMIT_SHA = args[2];
    const CIRCLE_PULL_REQUEST_URL = args[3];
    const SUDO_PASSWORD = args[4];
    if(!COMMIT_SHA) {
      throw new Error(`Missing entry value: COMMIT_SHA`);
    }
    if(!CIRCLE_PULL_REQUEST_URL) {
      throw new Error(`Missing entry value: CIRCLE_PULL_REQUEST`);
    }
    await exec('git fetch');
    await exec(`git checkout main`);
    await exec(`git pull origin main`);
    await exec(`git checkout ${COMMIT_SHA}`);

    // parse CIRCLE_PULL_REQUEST
    const CIRCLE_PULL_REQUEST = CIRCLE_PULL_REQUEST_URL.split('/pull/')[1];
    if(!existsSync(`/var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`)) {
 
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S mkdir /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      console.log('Created folder:', `stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    }
    await exec('npm run build');ignore_watch : ["node_modules"],
    
    console.log('Build successful');
    const port = Number([PREFIX, CIRCLE_PULL_REQUEST].join(''));
    // read/process package.json
    const packageJson = 'package.json';
    let pkg = JSON.parse(fs.readFileSync(packageJson).toString());

    // at this point you should have access to your ENV vars
    pkg.scripts.start = `next start -p ${port}`;

    // the 2 enables pretty-printing and defines the number of spaces to use
    fs.writeFileSync(packageJson, JSON.stringify(pkg, null, 2));

    // copy resource to serve folder
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp ${SERVED_FOLDER}/package.json /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    // await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp ${SERVED_FOLDER}/.env /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp -r ${SERVED_FOLDER}/.next /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp -r ${SERVED_FOLDER}/node_modules /var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
    
    const _app_context = `
    module.exports = {
      apps : [{
        name        : "stage${CIRCLE_PULL_REQUEST}.testcircleci.com",
        cwd         : "/var/www/stage${CIRCLE_PULL_REQUEST}.testcircleci.com",
        script      : "npm",
        args        : "start",
        watch       : true
      }]
    }
    `; 

    if(existsSync(`${ECOSYTEM_FILE}`)) {
      console.log('Removing existed ecosystem file.');
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm ${ECOSYTEM_FILE}`);
    }
    fs.writeFile(`${ECOSYTEM_FILE}`, _app_context, 'utf8', function (err) {
      if (err) throw err;
      console.log('The file has been saved!');
    });

    await exec(`/home/dominitech/.npm-global/bin/pm2 start ${ECOSYTEM_FILE}`);
    await exec('/home/dominitech/.npm-global/bin/pm2 save');
    console.log(`Starting app via port ${port}`);

    /// create virtual host
    const vh = `
      server {
        listen  80;

        server_name stage${CIRCLE_PULL_REQUEST}.testcircleci.com;

        location / {
                proxy_pass http://127.0.0.1:${PREFIX}${CIRCLE_PULL_REQUEST};
                proxy_http_version 1.1;
                proxy_set_header Upgrade ${'$'}${'http_upgrade'};
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP ${'$'}${'remote_addr'};
                proxy_set_header X-Forwarded-For ${'$'}${'remote_addr'};
                proxy_set_header Host ${'$'}${'host'};
                proxy_cache_bypass ${'$'}${'http_upgrade'};
        }
      }`;
      
      console.log(`Creating virtual host: stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      if(existsSync(`/etc/nginx/sites-available/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`)) {
        console.log('Removing existed sites-available nginx file.');
        await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm /etc/nginx/sites-available/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      } 
      if(existsSync(`/etc/nginx/sites-enabled/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`)) {
        console.log('Removing existed sites-enabled nginx file.');
        await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm /etc/nginx/sites-enabled/stage${CIRCLE_PULL_REQUEST}.testcircleci.com`);
      } 
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S sudo bash -c "echo '${vh}' | sudo tee -a /etc/nginx/sites-available/stage${CIRCLE_PULL_REQUEST}.testcircleci.com > /dev/null"`);
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S sudo bash -c "echo '${vh}' | sudo tee -a /etc/nginx/sites-enabled/stage${CIRCLE_PULL_REQUEST}.testcircleci.com > /dev/null"`);
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S systemctl restart nginx`);
      console.log('Deploy successful.');
      await exec(`exit`);

  } catch (e) {
    throw new Error(e.message);
  }
}

main();
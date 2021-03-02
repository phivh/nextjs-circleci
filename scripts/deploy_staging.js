const util = require('util');
const fetch = require('node-fetch');
const fs = require('fs');
const child_process = require('child_process'); 

const exec = util.promisify(child_process.exec); 
const { existsSync } = fs;

const SERVED_FOLDER = '/home/dominitech/workspace/test-circleci';
const DOMAIN = 'testcircleci.io';
const SITE_ORIGIN_DOMAIN = `staging.${DOMAIN}`;
const CLIENT_ROOT = '';

const main = async () => {
  try {
    const args = Object.values(process.argv);
    const SUDO_PASSWORD = args[2];
    const PIPELINE_ID = args[3];
    const BASIC_AUTH = args[4];

    const SITE_URL = `${SITE_ORIGIN_DOMAIN}/${CLIENT_ROOT}`;
    if(!existsSync(`/var/www/${SITE_URL}`)) {
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S mkdir /var/www/${SITE_URL}`);
      console.log('Created folder:', `${SITE_URL}`);
    }
    await exec('npm run build');
    
    console.log('Build successful');

    // copy resource to serve folder
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp ${SERVED_FOLDER}/package.json /var/www/${SITE_URL}`);
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp -r ${SERVED_FOLDER}/.next /var/www/${SITE_URL}`);
    await exec(`echo '${SUDO_PASSWORD}' | sudo -S cp -r ${SERVED_FOLDER}/node_modules /var/www/${SITE_URL}`);

    // cleanup
    console.log('Cleanup start.'); 

    const cleanup = async (prNumber) => {
      if(!prNumber) {
        return false;
      }
      // await exec(`echo '${SUDO_PASSWORD}' | sudo -S mkdir ${SERVED_FOLDER}`);
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm -rf /var/www/stage${prNumber}.${DOMAIN}`);
      await exec(`/home/dominitech/.npm-global/bin/pm2 delete stage${prNumber}.${DOMAIN}`);
      await exec('/home/dominitech/.npm-global/bin/pm2 save');
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm /etc/nginx/sites-available/stage${prNumber}.${DOMAIN}`);
      await exec(`echo '${SUDO_PASSWORD}' | sudo -S rm /etc/nginx/sites-enabled/stage${prNumber}.${DOMAIN}`);
    };

    const options = {
      method: 'GET',
      headers: {'Circle-Token': `${BASIC_AUTH}`}
    }; 
    const response = await fetch(`https://circleci.com/api/v2/pipeline/${PIPELINE_ID}`,options);
    const data = await response.json();
    const {vcs: {commit}} = data;
    const rxg = /([()])/g; 
    const prNumber = commit.replace(rxg, '').split('#')[1];
    await cleanup(prNumber);

    console.log('Cleanup done.');
    
    console.log('Deploy successful.');
    await exec(`exit`);

  } catch (e) {
    throw new Error(e.message);
  }
}

main();
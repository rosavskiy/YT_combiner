// PM2 Configuration для production
module.exports = {
  apps: [
    {
      name: 'yt-combiner-backend',
      script: './backend/src/server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'yt-combiner-python',
      script: './app.py',
      interpreter: './venv/bin/python',
      cwd: './python-workers',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        FLASK_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/python-error.log',
      out_file: './logs/python-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};

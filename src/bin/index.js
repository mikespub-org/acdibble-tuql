#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import express from 'express';
// migrate from express-graphql to graphql-http
import { createHandler } from 'graphql-http/lib/use/express';
import cors from 'cors';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import { printSchema } from 'graphql';

import {
  buildSchemaFromDatabase,
  buildSchemaFromInfile,
} from '../builders/schema';

const FilePath = (path) => {
  if (!fs.existsSync(path)) {
    console.log('');
    console.error(` > File does not exist: ${path}`);
    process.exit();
  }

  return fs.realpathSync(path);
};

const optionDefinitions = [
  {
    name: 'graphiql',
    alias: 'g',
    type: Boolean,
    description: 'Enable graphiql UI',
  },
  {
    name: 'db',
    type: FilePath,
    defaultValue: 'database.sqlite',
    description:
      'Path to the sqlite database you want to create a graphql endpoint for',
  },
  {
    name: 'infile',
    type: FilePath,
    description: 'Path to a sql file to bootstrap an in-memory database with',
  },
  {
    name: 'port',
    alias: 'p',
    type: Number,
    defaultValue: 4000,
    description: 'Port to run on (Default: 4000)',
  },
  {
    name: 'schema',
    alias: 's',
    type: Boolean,
    description: 'Write string representation of schema to stdout',
  },
  { name: 'help', alias: 'h', type: Boolean, description: 'This help output' },
];

const options = commandLineArgs(optionDefinitions);

if (options.help) {
  const usage = commandLineUsage([
    {
      header: 'tuql',
      content:
        '{underline tuql} turns just about any sqlite database into a graphql endpoint, including inferring associations',
    },
    {
      header: 'Basic usage',
      content: 'tuql --db path/to/db.sqlite',
    },
    {
      header: 'Options',
      optionList: optionDefinitions,
    },
    {
      content: 'Project home: {underline https://github.com/bradleyboy/tuql}',
    },
  ]);
  console.log(usage);
  process.exit();
}

const promise = options.infile
  ? buildSchemaFromInfile(options.infile)
  : buildSchemaFromDatabase(options.db);

if (options.schema) {
  promise.then((schema) => process.stdout.write(printSchema(schema)));
} else {
  const app = express();

  const message = options.infile
    ? `Creating in-memory database with ${options.infile}`
    : `Reading schema from ${options.db}`;

  console.log('');
  console.log(` > ${message}`);

  promise.then((schema) => {
    app.use(
      '/graphql',
      cors(),
      createHandler({
        schema
      }),
    );
    if (options.graphiql) {
      // https://expressjs.com/en/advanced/developing-template-engines.html#developing-template-engines-for-express
      app.engine('html', (filePath, options, callback) => { // define the template engine
        fs.readFile(filePath, (err, content) => {
          if (err) return callback(err)
          // this is an extremely simple template engine
          const rendered = content.toString()
            .replace('${options.port}', `${options.port}`)
          return callback(null, rendered)
        })
      });
      app.set('views', path.join(__dirname, '..', 'views')); // specify the views directory
      app.set('view engine', 'html'); // register the template engine
      app.get('/graphiql', (req, res) => {
        res.render('index', options)
      });
    }
    app.listen(options.port, () =>
      console.log(` > Running at http://localhost:${options.port}/graphql`),
    );
  });
}

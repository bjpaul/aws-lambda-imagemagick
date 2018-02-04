'use strict';

console.log('Loading function');

const aws = require('aws-sdk');
const im = require('imagemagick');
const fs = require('fs');
const path = require('path');
const s3 = new aws.S3({ apiVersion: 'latest' });


const convert = (req, callback) => {
  const fileNamePath = "image/sample/sample.png"
  const source_s3_bucket = "dev-state-ranking-system"
  // const fileNamePath = decodeURIComponent(req.Records[0].s3.object.key.replace(/\+/g, ' '));
  // const source_s3_bucket = req.Records[0].s3.bucket.name;
  const fileName = path.basename(fileNamePath);

  let outputFileName = 'converted-'+fileName
  let customArgs = null
  let customPngArgs = ['-strip']
  let customJpgArgs = ['-sampling-factor', '4:2:0', '-strip', '-quality', '85', '-interlace', 'JPEG', '-colorspace', 'sRGB']

  let ext = path.extname(fileName)
  console.log(`File extention ${ext}`);
  if( ext == '.png' || ext == '.PNG'){
    customArgs = customPngArgs
  }else if( ext == '.jpg' || ext == '.JPG' ||  ext == '.jpeg' || ext == '.JPEG'){
    customArgs = customJpgArgs
  }else{
    const message = `Non supported file ${fileNamePath}`;
    console.log(message);
    callback(message);
  }

  const inputS3params = {
      Bucket: source_s3_bucket,
      Key: fileNamePath,
  };
  const outputS3params = {
      Bucket: process.env.DEST_S3_BUCKET,
      ACL: 'public-read'
  };

  let inputFile = '/tmp/'+fileName
  let outputFile = '/tmp/'+outputFileName

  customArgs.unshift(inputFile);
  customArgs.push(outputFile);

  s3.getObject(inputS3params, (err, data) => {
      if (err) {
          console.log(err);
          const message = `Error getting object ${inputS3params.Key} from bucket ${inputS3params.Bucket}. Make sure they exist and your bucket is in the same region as this function.`;
          console.log(message);
           callback(message);
      } else {
          fs.writeFileSync(inputFile, data.Body);
          const inputFileSizeInBytes = fs.statSync(inputFile).size

          im.convert(customArgs, (err, output) => {
              if (err) {
                  console.log('Convert operation failed:', err);
                   callback(err);
              } else {
                  const outputFileSizeInBytes = fs.statSync(outputFile).size

                  console.log('Convert operation completed successfully');

                  if (inputFileSizeInBytes <= outputFileSizeInBytes){
                    console.log("Converted file is greater than the original....");
                    outputS3params.Key = fileNamePath
                    outputS3params.Body = data.Body

                  }else{
                    console.log("Converted file is smaller than the original....");
                    outputS3params.Key = fileNamePath
                    outputS3params.Body = fs.readFileSync(outputFile)
                  }
                  console.log(outputS3params);
                  s3.putObject(outputS3params , function(err, data) {
                      try {
                          fs.unlinkSync(inputFile);
                          fs.unlinkSync(outputFile);
                      } catch (err) {
                          // Ignore
                      }
                      if (err) {
                          console.log(err);
                          const message = `Error uploading object ${outputS3params.Key} to the bucket ${outputS3params.Bucket}. Make sure they exist and your bucket is in the same region as this function.`;
                          console.log(message);
                           callback(message);
                      } else {
                          const message = 'uploaded'
                          console.log(message);
                          callback(null, data);
                      }
                  });
              }
          });
      }
  });
};

exports.handler = (event, context, callback) => {
    const req = event;
    convert(req, callback);
};

const callback = function(data)  {
    console.log(data);
};

convert(null, callback);

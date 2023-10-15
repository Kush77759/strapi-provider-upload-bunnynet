"use strict"
var http = require('http')
var https = require('https')

const axios = require("axios")
var FormData = require('form-data');

const { ApplicationError } = require("@strapi/utils").errors

module.exports = {
  init({ api_key, storage_zone, pull_zone, storage_endpoint = "https://storage.bunnycdn.com" }) {
    console.log("storage_endpoint", storage_endpoint)

    if (!api_key || !storage_zone || !pull_zone) {
      throw new ApplicationError("BUNNY_API_KEY, BUNNY_STORAGE_ZONE or BUNNY_PULL_ZONE can't be null or undefined.")
    }

    const bunny_api = axios.create({
      baseURL: `${storage_endpoint}/${storage_zone}/`,
      timeout: 0,
      headers: {
        AccessKey: api_key,
       'Content-Type': 'multipart/form-data',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      maxRedirects: 0,
      onUploadProgress: function ({loaded, total, progress, bytes, estimated, rate, upload = true}) {
         console.log(progress);
      },
    })

    // Add a request interceptor
    bunny_api.interceptors.request.use(function (config) {
      // Do something before request is sent
      console.log(config);
      return config;
    }, function (error) {
      // Do something with request error
      console.log(error);
      return Promise.reject(error);
    });

    // Add a response interceptor
    bunny_api.interceptors.response.use(function (response) {
      // Any status code that lie within the range of 2xx cause this function to trigger
      // Do something with response data
      console.log(response);
      return response;
    }, function (error) {
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      // Do something with response error
      console.log(error);
      return Promise.reject(error);
    });

    const upload = (file) =>
      new Promise(async (resolve, reject) => {
        const data = file.stream || Buffer.from(file.buffer, "binary")
        try {
          const response = await bunny_api.put(`${file.hash}${file.ext}`, data)

          if (response.data.HttpCode !== 201) {
            reject(new Error(`Error uploading to Bunny.net: ${error.message}`))
          }

          file.url = `${pull_zone}/${file.hash}${file.ext}`
          resolve()
        } catch (error) {
          reject(new Error(`Error uploading to Bunny.net: ${error.message}`))
        }
      })

    return {
      upload(file) {
        return upload(file)
      },
      uploadStream(file) {
        return upload(file)
      },
      delete: async (file) => {
        return new Promise(async (resolve, reject) => {
          try {
            const response = await bunny_api.delete(`${file.hash}${file.ext}`)

            if (response.data.HttpCode !== 200) {
              console.error("Soft Error: Failed to delete file; has it already been deleted?", response.data)
              resolve()
            }

            resolve()
          } catch (error) {
            console.error("Soft Error: Failed to delete file; has it already been deleted?", error.message)
            resolve()
          }
        })
      },
    }
  },
}

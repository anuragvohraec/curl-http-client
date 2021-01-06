import fetch from 'node-fetch';
import {HeadersInit} from 'node-fetch';

class CommonUtil{
    static toType(obj: any): string {
    //@ts-ignore
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    }    
}

export interface HTTPHeaders{
    [key:string]:any;
}
 export enum Action{
    CLIENT_SIDE_REQ
 }

export class  CompositeResponse{
    constructor(
        public body: string|WritableStream,
        public headers:HTTPHeaders,
        public statusCode:number,
        public reqAction:Action
    ){}
}


export enum HTTPResponseExpectation{
    GET_JSON,
    POST_JSON,
    DOWNLOAD_FILE,
    UPLOAD_FILE
  }

export enum HttpMethod{
    HEAD,GET,PUT,POST,DELETE
}

export interface ReqParam{
    headers?: HTTPHeaders,
    body?:string,
    readableStream?:ReadableStream,
    writableStream?:WritableStream}

export interface CurlRequest{
         method: HttpMethod;
        inputUriString: string;
        reqParam?:ReqParam;        
}

export interface ValidationFunction{
    ():Promise<CompositeResponse>;
}

class ValidationEngine{
    static async tryThisValidation( validationFunction: ValidationFunction, action: Action) :Promise<CompositeResponse>{
        try{
          const result: CompositeResponse= await validationFunction();
          return result;
        }catch(e){
          console.error(e);
          let errmsg:string;
          if(CommonUtil.toType(e)==='string'){
              errmsg= JSON.stringify({error:e});
          }else{
            errmsg=JSON.stringify({error: e.msg})
          }
          const status:number = e.status?e.status:500;
          const cr:CompositeResponse = {
            body: errmsg,
            headers: {
              "Content-Type":"application/json",
              "Content-Length": "${errmsg.length}"
            }, statusCode: status, reqAction: action
          };
          return cr;
        }
      }
      
}


export class CurlHttpClient{
  
    constructor(private _domainName:string, private _def_headers: HTTPHeaders){};
  
    _convertHeadersToStringType(headers?:HTTPHeaders):HeadersInit{
      let result:HTTPHeaders={};
      if(headers!=null){
        for(let key of Object.keys(headers)){
          if(CommonUtil.toType(headers[key])==="string"){
            result[key]=headers[key]; 
          }else{
            result[key]=JSON.stringify(headers[key]);
          }
        }
      }
      for(let key of Object.keys(this._def_headers)){
        if(CommonUtil.toType(this._def_headers[key])==="string"){
          result[key]=this._def_headers[key]; 
        }else{
          result[key]=JSON.stringify(this._def_headers[key]);
        }
      }
      return result;
    }
  
  
    async process( expectation:HTTPResponseExpectation,  method:HttpMethod, inputUriString:string,
        reqParam: ReqParam):Promise<CompositeResponse>{
      const action=Action.CLIENT_SIDE_REQ;
  
      return await ValidationEngine.tryThisValidation(async()=>{
        try{
          //TODO remove this console.log
          //console.log("Processing HTTP clinet request");
          
            const headers:HTTPHeaders = this._convertHeadersToStringType(reqParam.headers);
          const url:string = `${this._domainName}${inputUriString}`;
  
          if(expectation == HTTPResponseExpectation.DOWNLOAD_FILE && reqParam.writableStream==null){
            return new CompositeResponse(JSON.stringify({error:"For downloading a file, NodeJS.WritableStream argument muts be given!"}),{},400,Action.CLIENT_SIDE_REQ);
          }else if(expectation==HTTPResponseExpectation.UPLOAD_FILE){
            if(!reqParam.readableStream){
              return new CompositeResponse(JSON.stringify({error:"For uploading a file, NodeJS.ReadableStream argument must be given!"}),{},400,Action.CLIENT_SIDE_REQ);
            }
            if(!headers["content-type"]){
              return new CompositeResponse(JSON.stringify({error:"For uploading a file, Content-Type header must be given!"}),{},400,Action.CLIENT_SIDE_REQ);
            }
          } else if(expectation==HTTPResponseExpectation.POST_JSON){
            if(!reqParam.body){
              return new CompositeResponse(JSON.stringify({error:"For POSTING a json, body must not be emtpy!"}),{},400,Action.CLIENT_SIDE_REQ);
            }else{
              if(headers["content-type"]!=="application/json"){
                return new CompositeResponse(JSON.stringify({error:"Content type muts be application/json !"}),{},400,Action.CLIENT_SIDE_REQ);
              }
            }
          }
  
          switch(expectation){
            case HTTPResponseExpectation.GET_JSON:{
              switch(method){
                case HttpMethod.GET:
                  var res = await  fetch(url,{
                      headers: headers
                  });
                  return new CompositeResponse(await res.text(),res.headers,res.status, action);
                case HttpMethod.POST:
                  var res = await   fetch(url,{
                      method:"POST",
                      headers:headers,
                      body: reqParam.body
                  });
                  return new CompositeResponse(await res.text(),res.headers,res.status, action);
                case HttpMethod.PUT:
                  var res = await   fetch(url, {
                      method: "PUT",
                      headers: headers, body: reqParam.body,
                  } );
                  return new CompositeResponse(await res.text(),res.headers,res.status, action);
                case HttpMethod.DELETE:
                  var res = await   fetch(url, {
                      method: "DELETE",
                      headers: headers
                  });
                  return new CompositeResponse(await res.text(),res.headers,res.status, action);
                default:
                  return new CompositeResponse(JSON.stringify({error:"HEAD cannot get JSON data! API if do support it, such API needs correction!"}),{},400,Action.CLIENT_SIDE_REQ);
              }
            }
              break;
            case HTTPResponseExpectation.POST_JSON:{
              switch(method){
                case HttpMethod.POST:
                    var res = await   fetch(url,{
                        method:"POST",
                        headers:headers,
                        body: reqParam.body
                    });
                    return new CompositeResponse(await res.text(),res.headers,res.status, action);
                case HttpMethod.PUT:
                    var res = await   fetch(url, {
                        method: "PUT",
                        headers: headers, body: reqParam.body,
                    } );
                    return new CompositeResponse(await res.text(),res.headers,res.status, action);
                case HttpMethod.DELETE:
                    var res = await   fetch(url, {
                        method: "DELETE",
                        headers: headers
                    });
                    return new CompositeResponse(await res.text(),res.headers,res.status, action);
                default:
                    return new CompositeResponse(JSON.stringify({error:"HEAD cannot get JSON data! API if do support it, such API needs correction!"}),{},400,Action.CLIENT_SIDE_REQ);
              }
            }
              break;
              case HTTPResponseExpectation.DOWNLOAD_FILE:
                switch(method){
                  case HttpMethod.GET:
                    {
                      var res = await  fetch(url, {headers: headers});
                      res.body.pipe(reqParam.writableStream!);
                      return new CompositeResponse(JSON.stringify({ok:true}), res.headers,res.status, action);
                    }
                    break;
                  case HttpMethod.POST:
                    {
                        var res = await  fetch(url, {method: "POST" ,headers: headers});
                        res.body.pipe(reqParam.writableStream!);
                        return new CompositeResponse(JSON.stringify({ok:true}), res.headers,res.status, action);
                    }
                    break;
                  default:
                    return new CompositeResponse(JSON.stringify({error:"Only GET and POST can be used to download a file"}),{},400,Action.CLIENT_SIDE_REQ);
                }
                break;
              case HTTPResponseExpectation.UPLOAD_FILE:
                switch(method){
                  case HttpMethod.PUT:
                    {
                        var res = await  fetch(url, {method: "PUT" ,headers: headers, body: reqParam.readableStream});
                        return new CompositeResponse(JSON.stringify({ok:true}), res.headers,res.status, action);
                    }
                    break;
                  default:
                    return new CompositeResponse(JSON.stringify({error:"Only PUT can be used to upload a file"}),{},400,Action.CLIENT_SIDE_REQ);
                }
                break;
        }
          return new CompositeResponse(JSON.stringify({error:"Client needs an upgrade, as no such switch available"}),{},500, Action.CLIENT_SIDE_REQ);
        }catch(e){
          return new CompositeResponse(JSON.stringify({error:"No Network"}),{},503, action);
        }
  
      },action);
    }
  
    async curl( expectation:HTTPResponseExpectation, cr:CurlRequest):Promise<CompositeResponse>{
      const response:CompositeResponse = await this.process(expectation,
          cr.method, cr.inputUriString, {body: cr.reqParam?.body, headers: cr.reqParam?.headers,
            writableStream:  cr.reqParam?.writableStream,
            readableStream:  cr.reqParam?.readableStream});
  
      return response;
    }
  }
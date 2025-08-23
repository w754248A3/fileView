
export interface FileListJSONData {

    isfolder:boolean;

    name:string;
}

export interface ZIPListJSONData {

    index:number;

    path:string;
}


export interface ViewListData{

    folder:Array<{path:string, name:string}>,
  file:Array<{path:string, name:string, imgPath:string, isView:boolean}>
}
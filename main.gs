
// LINE Messaging APIのチャネルアクセストークン
var LINE_ACCESS_TOKEN = "";

// 画像を保存するフォルダーID
var GOOGLE_DRIVE_FOLDER_ID = "";
var SPREAD_SHEET_FILE_ID = '';
var SHEET_NAME = '';

// ファイル名に使う現在日時をDay.jsライブラリーを使って取得
var date = dayjs.dayjs(); //現在日時を取得
var formattedDate = date.format("YYYYMMDD_HHmmss");

// LINE Messaging APIからPOST送信を受けたときに起動する
// jsonString はJSON文字列
function doPost(jsonString){
    if (typeof jsonString === "undefined"){
        //jsonStringがundefinedの場合動作を終了する
        return;
    }

    // JSON文字列をパース(解析)し、変数jsonに格納する
    var json = JSON.parse(jsonString.postData.contents);

    // 受信したメッセージ情報を変数に格納する
    var reply_token = json.events[0].replyToken; // reply token
    var messageId = json.events[0].message.id; // メッセージID
    var messageType = json.events[0].message.type; // メッセージタイプ

    // LINEで送信されたものが画像以外の場合、LINEで返信し動作を終了する
    if(messageType !== "image"){
        var messageNotImage = "画像を送信してください";
        // 変数reply_tokenとmessageNotImageを関数replyLINEに渡し、replyLINEを実行する
        replyLINE(reply_token, messageNotImage);
        return;
    }

    var LINE_END_POINT = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";

    // 変数LINE_END_POINTとreply_tokenを関数getOCRImageに渡し、getOCRImageを実行する
    getOCRImage(LINE_END_POINT, reply_token);
}


// Blob形式で画像を取得する
function getOCRImage(LINE_END_POINT, reply_token){

    try {
        var url = LINE_END_POINT;

        var headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Authorization": "Bearer " + LINE_ACCESS_TOKEN
        };

        var options = {
            "method" : "get",
            "headers" : headers,
        };

        // ユーザーからLINEで送られてきた画像を取得
        var response = UrlFetchApp.fetch(url, options);

        // その画像をBlob形式に変換し、ファイル名を設定する
        // ファイル名: LINE画像_YYYYMMDD_HHmmss.png
        var imageBlob = response.getBlob().getAs("image/png").setName("LINE画像_" + formattedDate + ".png");

        // imageBlobをgoogle driveに保存
        saveImageInDrive(imageBlob);

        // 変数imageBlobとreply_tokenを関数saveImageに渡し、ocrImageを起動する
        // 一方でreply_tokenと一緒にimageBlobを渡してOCRを実行する
        ocrImage(imageBlob, reply_token);

    } catch(error) {
        // 例外エラーが起きた時にログを残す
        Logger.log(error.message);
    }
}

function saveImageInDrive(imageBlob) {
    // 画像保存先のフォルダを取得
    var folder = DriveApp.getFolderById(GOOGLE_DRIVE_FOLDER_ID);

    // フォルダーに画像ファイルを作成(この変数使わないけどGASの使われない変数の書き方わからないから残しおく)
    // この処理がないとフォルダー内にドキュメントファイルは増えても画像ファイルが増えないから何を投稿しても同じ画像のデータしかスプレッドシートに吐き出されない
    var file = folder.createFile(imageBlob);
}

// 画像データをOCRにかけテキストを取得。
// 保存された画像、作成されたドキュメントファイルは残す。
// OCRで得られたテキストをLINE Botへ返信する。
function ocrImage(imageBlob, reply_token){
    try{
        // フォルダー内の情報を取ってきてる(*多分)
        let fileList = Drive.Children.list(GOOGLE_DRIVE_FOLDER_ID);

        // 設定事項を書いていく
        let resource = {
        title: "OCR結果" + formattedDate // 生成されるGoogleドキュメントのファイル名
        };
        let option = {
            "ocr": true,// OCRを行うかの設定です
            "ocrLanguage": "ja",// OCRを行う言語の設定です
        };

        // 取得した画像ファイル一覧から最新のファイルのfileIdを取得
        let fileId = fileList.items[0].id;
        // 指定したfileIdの画像ファイルのコピーを生成&OCRの実行(*多分)
        let image = Drive.Files.copy(resource, fileId, option);
        // コピーファイルにはOCRのデータが含まれているのでテキストを取得します
        let text = DocumentApp.openById(image.id).getBody().getText();

        // 作成したOCRファイルは不要なので削除
        Drive.Files.remove(image.id) //作成したOCRファイルを削除

        // OCRで得られたテキストを、現在のスプレッドシートの一番最終行+1行に張り付ける。
        var spreadSheetFile = SpreadsheetApp.openById(SPREAD_SHEET_FILE_ID);
        var sheet = spreadSheetFile.getSheetByName(SHEET_NAME);
        var lastRow = sheet.getLastRow();
        sheet.getRange(lastRow+1, 1).setValue(text);

        // OCRで得られたテキストを、LINEBotへ返信する。
        var message = "画像をOCRしリモート環境に保存しました。\n"+text;
        // 変数reply_tokenとmessageを関数replyLINEに渡し、replyLINEを実行する
        replyLINE(reply_token, message);
    } catch(error){
        // 例外エラーが起きた時にログを残す
        Logger.log(error);
    }
}


// ユーザーに返信する(= LINE PlatformへPostリクエストを送る)
function replyLINE(reply_token, text){
    // 返信先URL
    var replyUrl = "https://api.line.me/v2/bot/message/reply";

    var headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    };

    var postData = {
        "replyToken": reply_token,
        "messages": [{
            "type": "text",
            "text": text
            }]
    };

    var options = {
        "method" : "post",
        "headers" : headers,
        "payload" : JSON.stringify(postData)
    };

    // LINE Messaging APIにデータを送信する
    UrlFetchApp.fetch(replyUrl, options);
}

// ログを用意したからデバッグしたい時に使ってね(スプレッドシートにログが出力されます)
function log(message){
    var spreadSheetFile = SpreadsheetApp.openById(SPREAD_SHEET_FILE_ID);
    var sheet = spreadSheetFile.getSheetByName('DebugLog');
    sheet.appendRow([message]);
}

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const {google} = require("googleapis");
var generator = require('generate-password');
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');

var app = express();
app.set('view-engine', 'ejs');

const auth = new google.auth.GoogleAuth({
    keyFile: "./google_api/cred.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
});
const googleSheets = google.sheets({version:"v4", auth: async function() { return await auth.getClient(); }});
var spreadsheetId = "1EZ7A_gIdnUCxEd_u5jVjuc52sWB5SDXpT8NQy5C-o9w";

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const initializePassport = require('./passport-config');
initializePassport(passport, async email => {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:C",
        });
        let d = getRows.data.values;
        for (let i=1; i<d.length; i++) {
            if (d[i][1] === email) {
                user = {
                    'id': i,
                    'name': d[i][0],
                    'email': d[i][1], 
                    'password': d[i][2]
                }
                //console.log(user);
                return user;
            } 
        }
        return null;
    }
    catch { return null; }
},
async id => {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:C",
        });
        let d = getRows.data.values;
        if (id<d.length && id > 0) {
            let user = {
                'id': id,
                'name': d[id][0],
                'email': d[id][1], 
                'password': d[id][2]
            }
            //console.log(user);
            return user;
        }
        return null;
    } catch { return null; }
});

app.use(express.static(path.join(__dirname, '/dist/public'), {
    index: false, 
    immutable: true, 
    cacheControl: true,
    maxAge: "30d"
}));
app.set('port', process.env.PORT || 8070);
var server = app.listen(app.get('port'), function() {
  console.log('listening on port ', server.address().port);
});

app.get('/history/:id', checkAuthenticated, async function(req, res) {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:T",
        });
        let data = getRows.data.values;
        res.render('history.ejs');
    }
    catch {}
    
})

app.get('/', checkAuthenticated, async (req, res) => {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:T",
        });
        let data = getRows.data.values;
        let score = [];
        for (let i=2; i<data.length; i++) {
            if (data[i][5]==undefined) {
                score.push({'name': data[i][0], 'score': 0});
                continue;
            }
            else if (data[i][5]=='') {
                score.push({'name': data[i][0], 'score': 0});
                continue;
            }
            score.push({'name': data[i][0], 'score': parseInt(data[i][5])});
        }
        score.sort(function(a, b) { return b.score - a.score; })
        let index = [];
        let k=1;
        index.push(1);
        for (let i=1; i<score.length; i++) {
            if (score[i].score!=score[i-1].score) k++;
            index.push(k);
        }
        res.render('index.ejs', { rank : score, ind : index });
    } 
    catch {}
    
})

app.post('/form', checkAdminAuthenticated, async function(req, res) {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:V",
        });
        var user = {
            'name':req.body.username1,
            'position':'',
            'category':'',
            'presence':false,
            'style':false,
            'styleDescription':'',
            'meetingdate':'',
            'score':0,
            'early':false,
            'justificationDate':''
        }
        if (user.name!=undefined) {
            user.position = req.body.position1;
            user.category = req.body.categoryM;
            if (req.body.presence=='T') user.presence = true;
            if (req.body.style1=='T') {
                user.style = true;
                user.styleDescription = req.body.styleD1;
            } 
            user.meetingdate = req.body.day + "/" + req.body.month + "/" + req.body.year;
        }
        else if (req.body.username2!=undefined) {
            user.name = req.body.username2;
            user.position = req.body.position2;
            user.category = req.body.categoryT;
            if (req.body.early=='T') user.early = true;
            else user.early = false;
            if (user.category==undefined) user.category = req.body.categoryTS;
            user.score = parseInt(req.body.scoreT);
            if (req.body.style2=='T') {
                user.style = true;
                user.styleDescription = req.body.styleD2;
            } 
        }
        else {
            user.name = req.body.username3;
            user.justificationDate = req.body.date3;
        }
        console.log(req.body);
        console.log(user);
        let data = getRows.data.values;
        var line = 1;
        for (let i=1; i<data.length; i++) {
            let name = data[i][0].replace(/\s/g, '');
            if (name==user.name) {
                line = i+1;
                break;
            }
        }
        console.log(data[line-1]);
        var newScore = CalcScore(user);
        console.log(newScore);
        console.log(data[line-1].length);
        var currentScore = 0;
        if (data[line-1].length>=6) {
            if (data[line-1][5]!='') currentScore = parseInt(data[line-1][5]);
        }
        newScore += currentScore;
        console.log(newScore);
        let meetingNumbers = 0;
        let taskNumbers = 0;
        if (data[line-1].length>=7) {
            if (data[line-1][6]!='') meetingNumbers += parseInt(data[line-1][6]);
        }
        if (data[line-1].length>=13) {
            taskNumbers += 1;
            if (data[line-1][12]!='') taskNumbers += parseInt(data[line-1][12]);
        }
        if (isMeeting(user.category)) {
            meetingNumbers += 1;
            let styleDescription;
            if (user.styleDescription=='') styleDescription = '';
            else styleDescription = user.styleDescription;
            let mt = [newScore, meetingNumbers];
            if (data[line-1][7]==undefined) mt.push(meetingType(user));
            else mt.push(data[line-1][7]+'\n'+meetingType(user));

            if (data[line-1][8]==undefined) mt.push(user.meetingdate);
            else mt.push(data[line-1][8]+'\n'+user.meetingdate);

            if (data[line-1][9]==undefined) mt.push(user.presence);
            else mt.push(data[line-1][9]+'\n'+user.presence);

            if (data[line-1][10]==undefined) mt.push(user.style);
            else mt.push(data[line-1][10]+'\n'+user.style);

            if (data[line-1][11]==undefined) mt.push(styleDescription);
            else mt.push(data[line-1][11]+'\n'+styleDescription);

            await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: "Score!F"+line.toString()+":L"+line.toString(),
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [mt],
                },
            });
        }
        else if (user.justificationDate=='') {
            taskNumbers += 1;
            let styleDescription;
            if (user.styleDescription=='') styleDescription = '';
            else styleDescription = user.styleDescription;
            let mt = [newScore, meetingNumbers];
            if (data[line-1][7]==undefined) mt.push('');
            else mt.push(data[line-1][7]);
            if (data[line-1][8]==undefined) mt.push('');
            else mt.push(data[line-1][8]);
            if (data[line-1][9]==undefined) mt.push('');
            else mt.push(data[line-1][9]);
            if (data[line-1][10]==undefined) mt.push('');
            else mt.push(data[line-1][10]);
            if (data[line-1][11]==undefined) mt.push('');
            else mt.push(data[line-1][11]);
            mt.push(taskNumbers);
            
            if (data[line-1][13]==undefined) mt.push(taskType(user));
            else mt.push(data[line-1][13]+'\n'+taskType(user));

            if (data[line-1][14]==undefined) mt.push(getCurrentTime()[0]);
            else mt.push(data[line-1][14]+'\n'+getCurrentTime()[0]);

            if (data[line-1][15]==undefined) mt.push(user.score);
            else mt.push(data[line-1][15]+'\n'+user.score);

            if (data[line-1][16]==undefined) mt.push(user.style);
            else mt.push(data[line-1][16]+'\n'+user.style);

            if (data[line-1][17]==undefined) mt.push(styleDescription);
            else mt.push(data[line-1][17]+'\n'+styleDescription);

            if (data[line-1][18]==undefined) mt.push(user.early);
            else mt.push(data[line-1][18]+'\n'+user.early);
            console.log(mt);
            await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: "Score!F"+line.toString()+":S"+line.toString(),
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [mt],
                },
            });
        }
        else {
            let mt = [];
            if (data[line-1].length>=6) {
                if (data[line-1][5]!='') currentScore = parseInt(data[line-1][5]);
            }
            if (data[line-1][19]==undefined) {
                mt.push(user.justificationDate);
                newScore += 2;
            }
            else {
                const justifs = data[line-1][19].split('\n');
                if (!justifs.includes(user.justificationDate)) {
                    mt.push(data[line-1][19]+'\n'+user.justificationDate);
                    newScore += 2;
                }
            }
            await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: "Score!F"+line.toString()+":F"+line.toString(),
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [[newScore]],
                },
            });
            await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: "Score!T"+line.toString()+":T"+line.toString(),
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [mt],
                },
            });
        }
    }
    catch {}
});

app.get('/form', checkAdminAuthenticated, async (req, res) => {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:A",
        });
        const getDates = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!I:I",
        });
        let nospace = [];
        var datesnospace = [];
        let d = getRows.data.values;
        let da = getDates.data.values;
        for (let i=0; i<d.length; i++) {
            nospace.push(d[i][0].replace(/\s/g, ''));
        }
        for (let i=2; i<da.length; i++) {
            if (da[i][0]==undefined) continue;
            const myArray = da[i][0].split('\n');
            for (let j=0; j<myArray.length; j++) {
                if (!datesnospace.includes(myArray[j])) datesnospace.push(myArray[j]);
            }
        }
        res.render('form.ejs', { names : d, tags : nospace, dates: datesnospace, datetags: datesnospace });
    }
    catch {}
})

app.get('/login', (req, res) => {
    //res.setHeader('content-type', 'text/css');
    //res.type('css');
    res.render('login.ejs');
})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.get('/list', checkAdminAuthenticated, async (req, res) => {
    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Score!A:F",
    });
    res.send(getRows.data);
});

app.get('/pwd', checkAdminAuthenticated, async function (req, res) {
    await generatePasswords(res);
    //await hashPasswords();
});

app.get('/pwdadmin', checkAdminAuthenticated, async function (req, res) {
   await adminP(res);
});

function CalcScore(user) {
    let meeting = ['GM', 'TM', 'TS', 'GA', 'ID'];
    let s = 0;
    let p = false;
    for (let i=0; i<meeting.length; i++) {
        if (meeting[i]==user.category) {
            p = true;
            break;
        }
    }
    if (p==true && user.presence==true) s+=1;
    else if (p==true && user.presence==false) s-=2;
    if (user.style==true) s+=1;
    if (p==false && user.score==0 && user.justificationDate=='') s-=2;
    else {
        s+=user.score;
        if (user.early==true) s+=1;
    }
    return s;
}

function isMeeting(category) {
    let meeting = ['GM', 'TM', 'TS', 'GA', 'ID'];
    for (let i=0; i<meeting.length; i++) {
        if (meeting[i]==category) return true;
    }
    return false;
}

function meetingType(user) {
    if (user.category=='GM') return "General Meeting";
    if (user.category=='TM') {
        if (user.position=='MM') return "Media Team Meeting";
        if (user.position=='SM') return "Sponsoring Team Meeting";
        if (user.position=='TM') return "Training Team Meeting";
    }
    if (user.category=='TS') return "Training Session";
    if (user.category=='GA') return "General Assembly";
    if (user.category=='ID') return "Integration Day";
}

function taskType(user) {
    if (user.category=='GD') return "Graphical Design";
    if (user.category=='VE') return "Video Editing";
    if (user.category=='RD') return "Redaction";
    if (user.category=='SO') return "Sponsorship Outing";
    if (user.category=='CT') return "Contacting Trainers";
    return user.category;
}

async function generatePasswords(res) {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:B",
        });
        let d = getRows.data.values;
        //var ids = [];
        var hashedIds = [];
        var id = generator.generate({
            length: 30,
            numbers: true
        });
        for (let i=2; i<d.length; i++) {
            //ids.push({'id': i, 'name': d[i][0], 'email': d[i][1], 'password': id});
            var hid = await bcrypt.hash(id, 10);
            hashedIds.push([hid]);
        }
        let num = hashedIds.length+2;
        
        await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: "Score!C3:C"+num.toString(),
            valueInputOption: "USER_ENTERED",
            resource: {
                values: hashedIds,
            },
        });
        res.send({'member': id});
    }
    catch {
        //res.redirect('/pwd');
    }
}

async function adminP(res) {
    try {
        let id = generator.generate({
            length: 30,
            numbers: true
        });
        let hid = await bcrypt.hash(id, 10);
        await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: "Score!C2:C2",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[hid]],
            },
        });
        res.send({'root': id});
    }
    catch {
        //res.redirect('/adminpwd');
    }
}

/*async function newP(res) {
    try {
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Score!A:C",
        });
        let d = getRows.data.values;
        var ids = [];
        var hashedIds = [];
        let init = 0;
        for (let i=1; i<d.length; i++) {
            if (d[i][2]==undefined) {
                console.log(d[i][2]);
                if (init==0) init = i+1;
                var id = generator.generate({
                    length: 30,
                    numbers: true
                });
                ids.push({'id': i, 'name': d[i][0], 'email': d[i][1], 'password': id});
                id = await bcrypt.hash(id, 10);
                hashedIds.push([id]);
            } 
        }
        let num = d.length+1;
        
        await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: "Score!C"+init.toString()+":C"+num.toString(),
            valueInputOption: "USER_ENTERED",
            resource: {
                values: hashedIds,
            },
        });
        res.send(ids);
    }
    catch {
        res.redirect('/npwd');
    }
}*/

async function elementInGoogleSheets(element, A) {
    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Score!"+A,
    });
    let data = getRows.data.values;
    for (let i=1; i<data.length; i++) {
        if (data[i][0]==element) return true;
    }
    return false;
}

async function getElementById(id, F) {
    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Score!"+F+":"+F,
    });
    let data = getRows.data.values;
    if (id<data.length) return data[id][0];
    return "";
}

async function getIdByEmail(email) {
    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Score!A:A",
    });
    let data = getRows.data.values;
    for (let i=1; i<data.length; i++) {
        if (data[i][0]==email) return i;
    }
    return 0;
}

function getCurrentTime() {
    let ts = Date.now();
    let date_ob = new Date(ts);
    let date = date_ob.getDate();
    let month = date_ob.getMonth() + 1;
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();
    return [year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds, hours + ":" + minutes];
}

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function checkAdminAuthenticated(req, res, next) {
    if (req.session.passport==undefined) res.redirect('/login');
    if (req.session.passport.user==1) {
        return next();
    }
    res.redirect('/login');
}
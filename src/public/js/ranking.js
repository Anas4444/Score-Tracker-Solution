let allNum = document.querySelector('.allNum'); //數量計算
let list = document.querySelector('.list'); //主要畫面
let url = 'https://raw.githubusercontent.com/hexschool/hexschoolNewbieJS/master/data.json';
let btnSort = document.querySelector('.btnSort'); //排序按鈕
let btnSame = document.querySelector('.btnSame'); //相同名次按鈕
let btnId = document.querySelector('.btnId'); //id排序按鈕
let btnName = document.querySelector('.btnName'); //姓名排序
let select = document.querySelector('#select');//下拉選單

let allData = []; //把資料放在全域變數內才能讓其他方訊使用

axios.get(url).then(res => {
    allData = res['data']; //不能直接用res['data']，allName()抓不到
    // console.log(allData);
    allName(allData);
    // sortFn(); //直接就是排序畫面
}).catch(err => {
    console.log(err);
})

//Start Screen
let allName = () => {
    let text = '';
    allData.forEach((all, index) => {
        text += `<tr>
        <td>-</td>
        <td>${all['id']}</td>
        <td>${all['name']}</td>
        <td>Completion of special training courses：${all['process']}</td></tr>`
    })
    list.innerHTML = text;
    allNum.textContent = `shared${allData.length}pen data`;
}

//Completion ranking screen - The completion ranking screen is different from the starting screen, so take it apart first
let sortRender = () => {
    let str = '';
    allData.forEach((all2, i) => {
        str += `<tr data-num='1'>
        <td>No.${i+1}name</td>
        <td>${all2['id']}</td>
        <td>${all2['name']}</td>
        <td>Completion of special training courses：${all2['process']}</td></tr>`;
    });
    list.innerHTML = str;
}

//Sort by degree of completion
let sortFn = () => {
    allData.sort((a, b) => {
        return parseInt(b.process) - parseInt(a.process);
    });
    sortRender();
}
btnSort.addEventListener('click', sortFn, false);

//id sort
let sortId = () => {
    allData.sort((a, b) => {
        return parseInt(a.id) - parseInt(b.id);
    });
    allName(); //Use the start screen
}
btnId.addEventListener('click', sortId, false)

//name sort
let sortName = () => {
    allData.sort((a, b) => {
        let nameA = a.name.toUpperCase(); //to uppercase
        let nameB = b.name.toUpperCase();
        if (nameA < nameB) {
            return -1; //A negative number means a comes before b
        } else if (nameA > nameB) {
            return 1; //A positive number means a comes after b
        } else {
            return 0; //Stays the same, but the location changes depending on the browser
        }
    });
    allName(); //Use the start screen
}
btnName.addEventListener('click', sortName, false);


//Sort by the same progress and the same rank - I still have to write the screen again
let sortFnSame = () => {
    let str = '';
    let rank = 0; //ranking
    let score = 0; //Completeness
    let count = 0; //Calculate quantity
    allData.sort((a, b) => {
        return parseInt(b.process) - parseInt(a.process);
    }).forEach(item => {
        if(item.process != score){
            rank++;
            score = item.process;
            // console.log(rank);//Start from 1 after the first round of alignment
            // console.log(score);//Starts at 45% after the first lap
        }
        if(item.process == '0%'){ //Remove 0% and count 0% people
            count++;
            // console.log(count);//Confirm the number of people
            return;
        }
        str += `<tr data-num='2'>
        <td>No.${rank}name</td>
        <td>${item['id']}</td>
        <td>${item['name']}</td>
        <td>Completion of special training courses：${item['process']}</td></tr>`;
        
    });
    list.innerHTML = str;
    allNum.textContent = `shared${allData.length - count}pen data`;
}
btnSame.addEventListener('click',sortFnSame,false);

//drop down menu button
select.addEventListener('change',(e)=>{
    if(e.target.value == 'id'){
        sortId();
    }else if(e.target.value == 'process'){
        sortFn();
    }else if(e.target.value == 'name'){
        sortName();
    }else if(e.target.value == 'same'){
        sortFnSame();
    }else{
        return;
    }
})
<!DOCTYPE html>
<html>
<head>
<title>Student Management Table</title>
<link rel="stylesheet" href="style.css">
</head>

<body>

<div class="container">

<h2>Student Management Table</h2>

<div class="controls">
<input type="text" id="searchInput" placeholder="Search student">

<select id="courseFilter">
<option value="All">All Courses</option>
<option value="IT">IT</option>
<option value="CS">CS</option>
<option value="AI">AI</option>
<option value="DS">DS</option>
</select>

<button onclick="sortByMarks()">Sort by Marks</button>
</div>

<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>Age</th>
<th>Marks</th>
<th>Course</th>
</tr>
</thead>

<tbody id="studentTable"></tbody>

</table>

</div>

<script>
let Students = [];
let filteredStudents = [];

// Fetch data from API
async function fetchStudents(){
    const res = await fetch("api.php");
    Students = await res.json();
    filteredStudents = [...Students];
    displayStudents(Students);
}

function displayStudents(data){
    const table = document.getElementById("studentTable");
    table.innerHTML = "";

    data.forEach(student=>{
        let row = `
        <tr>
        <td>${student.id}</td>
        <td>${student.name}</td>
        <td>${student.age}</td>
        <td>${student.marks}</td>
        <td>${student.course}</td>
        </tr>
        `;
        table.innerHTML += row;
    });
}

function applyFilters(){
    const searchValue = document.getElementById("searchInput").value.toLowerCase();
    const courseValue = document.getElementById("courseFilter").value;

    filteredStudents = Students.filter(student => {
        const matchName = student.name.toLowerCase().includes(searchValue);
        const matchCourse = courseValue === "All" || student.course === courseValue;
        return matchName && matchCourse;
    });

    displayStudents(filteredStudents);
}

function sortByMarks(){
    filteredStudents.sort((a,b)=> b.marks - a.marks);
    displayStudents(filteredStudents);
}

document.getElementById("searchInput").addEventListener("keyup", applyFilters);
document.getElementById("courseFilter").addEventListener("change", applyFilters);

// Load data on start
fetchStudents();

</script>

</body>
</html>
<?php
header("Content-Type: application/json");

$students = [
    ["id"=>1, "name"=>"David", "age"=>20, "marks"=>78, "course"=>"IT"],
    ["id"=>2, "name"=>"Rahul", "age"=>21, "marks"=>85, "course"=>"CS"],
    ["id"=>3, "name"=>"Ananya", "age"=>19, "marks"=>92, "course"=>"AI"],
    ["id"=>4, "name"=>"Vikram", "age"=>22, "marks"=>74, "course"=>"IT"],
    ["id"=>5, "name"=>"Priya", "age"=>20, "marks"=>88, "course"=>"DS"],
    ["id"=>6, "name"=>"Karan", "age"=>21, "marks"=>69, "course"=>"IT"],
    ["id"=>7, "name"=>"Sneha", "age"=>19, "marks"=>95, "course"=>"AI"],
    ["id"=>8, "name"=>"Arjun", "age"=>20, "marks"=>81, "course"=>"CS"],
    ["id"=>9, "name"=>"Meera", "age"=>22, "marks"=>86, "course"=>"DS"],
    ["id"=>10, "name"=>"Rohan", "age"=>21, "marks"=>72, "course"=>"IT"]
];

echo json_encode($students);
?>
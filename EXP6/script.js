document.getElementById("registrationForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const email = document.getElementById("email").value;
    const skills = document.getElementById("skills").value;
    const hobbies = document.getElementById("hobbies").value;

    const formattedData = 
`----- USER DETAILS -----

Name: ${name}
Phone: ${phone}
Email: ${email}
Skills: ${skills}
Hobbies: ${hobbies}

------------------------`;

    document.getElementById("output").value = formattedData;

    document.getElementById("copyBtn").style.display = "block";
});

document.getElementById("copyBtn").addEventListener("click", function() {
    const output = document.getElementById("output");
    output.select();
    output.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(output.value);
    alert("Data copied to clipboard!");
});
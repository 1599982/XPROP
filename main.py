from flask import Flask, render_template

app = Flask(__name__, template_folder="public")

@app.route('/')
def casa():
	return render_template("index.html")

@app.route('/allenamiento')
def allenamiento():
	return render_template("training.html")

@app.route('/previsione/alfabeto')
def prv_alfabeto():
		return render_template("predict/alphabet.html")

@app.route('/previsione/numeri')
def prv_numeri():
		return render_template("predict/numbers.html")

@app.route('/allenamiento/alfabeto')
def all_alfabeto():
		return render_template("training/alphabet.html")

@app.route('/allenamiento/numeri')
def all_numeri():
	return render_template("training/numbers.html")

if __name__ == "__main__":
	app.run("localhost", 5000, debug=True)

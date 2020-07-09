# Installation
- Install jupyter nbextensions: https://jupyter-contrib-nbextensions.readthedocs.io/en/latest/install.html
- Find where the nbextensions get installed to using `jupyter --paths`. For each path listed, see if there is a path $PATH/nbextensions.
This varies by setup. 
- go to the nbextensions folder and clone this repository
- rerun `jupyter contrib nbextension install --user` to install the extension
- Enable the extension. Start `jupyter notebook`, click the 'nbextensions' tab, and enable the "Figure layout" extension
- Open a new notebook and begin using the widget!

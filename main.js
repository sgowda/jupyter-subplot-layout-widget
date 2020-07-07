define([
  'base/js/namespace',
  'base/js/events'
], function(Jupyter, events) {

  /**
   * Retrieve the coordinates of the given event relative to the center
   * of the widget.
   *
   * @param event
   *   A mouse-related DOM event.
   * @param reference
   *   A DOM element whose position we want to transform the mouse coordinates to.
   * @return
   *    A hash containing keys 'x' and 'y'.
   */
  function getRelativeCoordinates(event, reference) {
    var x, y;
    event = event || window.event;
    var el = event.target || event.srcElement;

    if (!window.opera && typeof event.offsetX != 'undefined') {
      // Use offset coordinates and find common offsetParent
      var pos = {
        x: event.offsetX,
        y: event.offsetY
      };

      // Send the coordinates upwards through the offsetParent chain.
      var e = el;
      while (e) {
        e.mouseX = pos.x;
        e.mouseY = pos.y;
        pos.x += e.offsetLeft;
        pos.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Look for the coordinates starting from the reference element.
      var e = reference;
      var offset = {
        x: 0,
        y: 0
      }
      while (e) {
        if (typeof e.mouseX != 'undefined') {
          x = e.mouseX - offset.x;
          y = e.mouseY - offset.y;
          break;
        }
        offset.x += e.offsetLeft;
        offset.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Reset stored coordinates
      e = el;
      while (e) {
        e.mouseX = undefined;
        e.mouseY = undefined;
        e = e.offsetParent;
      }
    } else {
      // Use absolute coordinates
      var pos = getAbsolutePosition(reference);
      x = event.pageX - pos.x;
      y = event.pageY - pos.y;
    }
    // Subtract distance to middle
    return {
      x: x,
      y: y
    };
  }

  var canvas_width = 640;
  var canvas_height = 480;

  var start_x = -1;
  var start_y = -1;
  var end_x = -1;
  var end_y = -1;
  window.subplots = []

  var state = "none";
  var clicked_subplot = -1;
  var clicked_corner = [-1, -1];

  var current_letter = 'A';

  function mousedown_callback(event) {
    console.log("mousedown");
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');

    let states = ["none", "new", "move", "resize"];


    let rel_loc = getRelativeCoordinates(event, elem);
    start_x = rel_loc.x;
    start_y = rel_loc.y;

    var margin = 10;
    for (i = 0; i < window.subplots.length; i += 1) {
      let subplot = window.subplots[i];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];
      if (start_x > x_bounds[0] && start_x < x_bounds[1] && start_y > y_bounds[0] && start_y < y_bounds[1]) {
        clicked_subplot = i;

        if (Math.abs(start_x - x_bounds[0]) < margin && Math.abs(start_y - y_bounds[0]) < margin) {
          clicked_corner = [0, 0];
          console.log("corner");
        } else if (Math.abs(start_x - x_bounds[1]) < margin && Math.abs(start_y - y_bounds[0]) < margin) {
          clicked_corner = [1, 0];
          console.log("corner");
        } else if (Math.abs(start_x - x_bounds[0]) < margin && Math.abs(start_y - y_bounds[1]) < margin) {
          clicked_corner = [0, 1];
          console.log("corner");
        } else if (Math.abs(start_x - x_bounds[1]) < margin && Math.abs(start_y - y_bounds[1]) < margin) {
          clicked_corner = [1, 1];
          console.log("corner");
        } else {
          clicked_corner = [-1, -1];
        }
        break;
      }
    }
    if (clicked_subplot >= 0) {
      if (clicked_corner[0] != -1 && clicked_corner[1] != -1) {
        state = "resize";
      } else {
        state = "move";
      }
    } else {
      state = "new";
    }
  }

  function mouseup_callback(event) {
    console.log("mouseup");
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');
    let states = ["none", "new", "move", "resize"];

    let rel_loc = getRelativeCoordinates(event, elem);
    end_x = rel_loc.x;
    end_y = rel_loc.y;


    if (state == "new") {
      // create object to represent subplot
      var py_height = Math.abs(start_y - end_y) / canvas_height;

      let width = Math.abs(start_x - end_x);
      let height = Math.abs(start_y - end_y);

      if (width < 15 && height < 15) {
        // clear selection
        for (let i = 0; i < window.subplots.length; i += 1) {
          let subplot = window.subplots[i];
          subplot.color = '#A0A0A0';
          subplot.selected = false;
        }
      } else {
        var subplot = {
          color: '#A0A0A0',
          width: width,
          height: height,
          top: Math.min(start_y, end_y),
          left: Math.min(start_x, end_x),
          letter: current_letter,
          py_width: Math.abs(start_x - end_x) / canvas_width,
          py_height: py_height,
          py_x0: Math.min(start_x, end_x) / canvas_width,
          py_y0: 1 - (Math.min(start_y, end_y) / canvas_height) - py_height,
          selected: false
        };
        window.subplots.push(subplot);

        // increment letter for next plot
        current_letter = String.fromCharCode(current_letter.charCodeAt(0) + 1);
      }

    } else if (state == "move") {
      displ_x = end_x - start_x;
      displ_y = end_y - start_y;

      var subplot = window.subplots[clicked_subplot];
      if (displ_x < 5 && displ_y < 5) {
        // treat this as a "select" action
        subplot.color = "#FF0000";
        subplot.selected = !subplot.selected; // toggle selection
      } else {
        // move action
        subplot.top += displ_y;
        subplot.left += displ_x;
      }

    } else if (state == "resize") {
      console.log("resize")
      var subplot = window.subplots[clicked_subplot];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];

      corner_displ_x = x_bounds[clicked_corner[0]] - end_x;
      corner_displ_y = y_bounds[clicked_corner[1]] - end_y;

      if (clicked_corner[0] == 0 && clicked_corner[1] == 0) {
        // top left corner
        subplot.width += corner_displ_x;
        subplot.height += corner_displ_y;

        subplot.left = end_x;
        subplot.top = end_y;
      } else if (clicked_corner[0] == 1 && clicked_corner[1] == 0) {
        // top right corner
        subplot.width -= corner_displ_x;
        subplot.height += corner_displ_y;

        subplot.top = end_y;
      } else if (clicked_corner[0] == 0 && clicked_corner[1] == 1) {
        // bottom left corner
        subplot.width += corner_displ_x;
        subplot.height -= corner_displ_y;

        subplot.left = end_x;
      } else if (clicked_corner[0] == 1 && clicked_corner[1] == 1) {
        // bottom right corner
        subplot.width -= corner_displ_x;
        subplot.height -= corner_displ_y;
      }
    }

    clicked_subplot = -1;
    clicked_corner = [-1, -1];
    state = "none"
    console.log("added to subplots");

    draw();
  }

  function draw() {
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');    
    context.clearRect(0, 0, elem.width, elem.height);

    for (let index = 0; index < window.subplots.length; index++) {
      var subplot = window.subplots[index];

      // draw object
      context.fillStyle = subplot.color;
      context.fillRect(subplot.left, subplot.top, subplot.width, subplot.height);
      context.font = "16px Arial";
      let subplot_letter = subplot.letter; // String.fromCharCode('A'.charCodeAt(0) + index);
      context.fillText(subplot_letter, subplot.left, subplot.top);
    }
  }

  function generate_code() {
    str = "import matplotlib.pyplot as plt\n%matplotlib notebook";
    str += "fig = plt.figure()\n";
    for (i = 0; i < window.subplots.length; i += 1) {
      subplot = window.subplots[i];
      let subplot_letter = String.fromCharCode('A'.charCodeAt(0) + i);
      str += `ax${subplot.letter} = fig.add_axes([${subplot.py_x0.toFixed(2)}, ${subplot.py_y0.toFixed(2)}, ${subplot.py_width.toFixed(2)}, ${subplot.py_height.toFixed(2)}])\n`;
      str += `fig.text(${subplot.py_x0.toFixed(2)}, ${(subplot.py_y0 + subplot.py_height).toFixed(2)}, "${subplot_letter}", fontsize=24, va='bottom', ha='right')\n`
    }

    Jupyter.notebook.insert_cell_below('code').set_text(str);

    // document.getElementById("code").innerHTML = str;
  }

  function clear() {
    window.subplots = [];
    draw();
  }

  function save() {

  }

  function load() {

  }

  function update() {
    let new_letter = $("#subplots_update").val();
    for (let i = 0; i < window.subplots.length; i += 1) {
      if (window.subplots[i].selected) {
        window.subplots[i].letter = new_letter;
      }
    }
    draw();
  }

  document.addEventListener("keydown", event => {
    if (event.keyCode == 90 && event.ctrlKey) {
      window.subplots.pop();
      draw();
    }
  });

  var add_cell = function() {
    window.subplots = [];

    Jupyter.notebook.insert_cell_above('code').set_text(`# Select your plot below`);
    Jupyter.notebook.select_prev();

    // Jupyter.notebook.cells_to_markdown() // convert to markdown, otherwise the cell won't execute
    // Jupyter.notebook.execute_cell_and_select_below();
    Jupyter.notebook.execute_cell();


    // # get reference to the stuff 
    Jupyter.notebook.select();
    var output_subarea = $("#notebook-container")
      .children('.selected')
      .children('.output_wrapper')
      .children('.output');


    // add event handlers
    var x = document.createElement("canvas");
    x.setAttribute("id", "canv2");
    x.setAttribute("style", "border:1px solid #000000;"); //  margin-left:150px
    x.setAttribute("width", 640);
    x.setAttribute("clientWidth", 640);
    x.setAttribute("height", 480);

    var generate_button = document.createElement("BUTTON");
    generate_button.innerHTML = "Generate python cell"
    generate_button.addEventListener("click", generate_code, false);

    let clear_button = document.createElement("button");
    clear_button.innerHTML = "Clear";
    clear_button.addEventListener("click", clear, false);

    let save_button = document.createElement("button");
    save_button.innerHTML = "Save";
    save_button.addEventListener("click", save, false);

    let load_button = document.createElement("button");
    load_button.innerHTML = "Load";
    load_button.addEventListener("click", load, false);

    var input_field = document.createElement("INPUT");
    input_field.setAttribute("type", "text");
    input_field.setAttribute("id", "subplots_update");

    let update_button = document.createElement("button");
    update_button.innerHTML = "Update";
    update_button.addEventListener("click", update, false);

    let div = document.createElement("div")
    div.appendChild(generate_button);
    div.appendChild(clear_button);
    div.appendChild(save_button);
    div.appendChild(load_button);
    div.appendChild(input_field);
    div.appendChild(update_button)
    div.appendChild(x)

    output_subarea[0].appendChild(div);

    var elem = document.getElementById('canv2');
    console.log(elem)
    elem.width = 640;
    elem.height = 480;

    elem.addEventListener('mousedown', mousedown_callback, false);
    elem.addEventListener('mouseup', mouseup_callback, false);
  };

  // Button to add default cell
  var addButton = function() {
    Jupyter.toolbar.add_buttons_group([
      Jupyter.keyboard_manager.actions.register({
        'help': 'Add figure layout generator',
        'icon': 'fa-play-circle',
        'handler': add_cell
      }, 'add-default-cell', 'Default cell')
    ])
  }
  // Run on start
  function load_ipython_extension() {
    addButton();
  }
  return {
    load_ipython_extension: load_ipython_extension
  };
});
"use strict";

// Variáveis
const form = document.querySelector(".form");
const container_workouts = document.querySelector(".workouts");
const input_type = document.querySelector(".form-input-type");
const input_distance = document.querySelector(".form-input-distance");
const input_duration = document.querySelector(".form-input-duration");
const input_cadence = document.querySelector(".form-input-cadence");
const input_elevation = document.querySelector(".form-input-elevation");

let map_event, map;

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _set_description() {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Setando texto do popup dos workouts
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calc_pace();
    this._set_description();
  }

  calc_pace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevation_gain) {
    super(coords, distance, duration);
    this.elevation_gain = elevation_gain;
    this.calc_speed();
    this._set_description();
  }

  calc_speed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////////
// Application Architecture
class App {
  // Variáveis privadas da classe
  #map;
  #map_zoom_level = 13;
  #map_event;
  #workouts = [];

  constructor() {
    // Função que vai coletar e mostrar a posição do usuario no mapa
    this._get_position();

    // Coletar informações do local storage
    this._get_local_storage();

    // Event listener para quando o formulario do workout for enviado
    form.addEventListener("submit", this._new_workout.bind(this));

    // Event listener para quando o tipo de exercicio for selecionado
    input_type.addEventListener("change", this._toggle_elevation_field);

    // Event listener para quando clicar em item da lista o mapa centralizar no marker
    container_workouts.addEventListener(
      "click",
      this._move_to_popup.bind(this)
    );
  }

  // Função para conseguir a localização do usuário
  _get_position() {
    navigator.geolocation.getCurrentPosition(
      this._load_map.bind(this),
      function () {
        alert("Could not get your position.");
      }
    );
  }

  // Função de carregamento do mapa
  _load_map(position) {
    // Definindo coordenadas atuais do usuário
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    // Variáveis usadas no mapa
    this.#map = L.map("map").setView(coords, this.#map_zoom_level);
    L.marker(coords).addTo(this.#map);

    // Função de loadind do mapa
    L.tileLayer(
      "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/navigation-day-v1",
        tileSize: 512,
        zoomOffset: -1,
        accessToken:
          "pk.eyJ1IjoiZGF2aWQzODIxIiwiYSI6ImNrc3RmbnlkNDE2Mmsyd2xtbXA0MWpuc3kifQ.RbxAc34mJzDrGhZZT7e2Sg",
      }
    ).addTo(this.#map);

    // Função executada ao clicar no mapa
    this.#map.on("click", this._show_form.bind(this));

    // Adicionar markers do local storage no mapa
    this.#workouts.forEach((work) => {
      this._render_workout_marker(work);
    });
  }

  _show_form(map_e) {
    this.#map_event = map_e;

    // Abrindo formulário de exercicio ao clicar no mapa
    form.classList.remove("hidden");
    input_distance.focus();
  }

  _hide_form() {
    // Limpar inputs
    input_cadence.value =
      input_distance.value =
      input_duration.value =
      input_elevation.value =
        "";

    // Esconder formulário
    form.style.display = "none";

    form.classList.add("hidden");
    setTimeout(() => {
      form.style.display = "grid";
    }, 1000);
  }

  _toggle_elevation_field() {
    // Seleção dos dois campos que serão alterados quando for alterado o tipo de exercicio
    // Usando método "closest" para selecionar o parent mais próximo
    input_elevation.closest(".form-row").classList.toggle("form-row-hidden");
    input_cadence.closest(".form-row").classList.toggle("form-row-hidden");
  }

  _new_workout(e) {
    // Prevenir que a página recarregue ao enviar formulário
    e.preventDefault();

    // Funções auxiliares
    // Função para validar inputs
    const valid_inputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));

    // Função para validar numeros positivos
    const all_positive = (...inputs) => inputs.every((inp) => inp > 0);

    // Coletar data do formulário
    const type = input_type.value;
    const distance = +input_distance.value; // + converte para numero
    const duration = +input_duration.value;
    const { lat, lng } = this.#map_event.latlng;
    let workout;

    // Se o workout for running, criar um objeto running
    if (type === "running") {
      const cadence = +input_cadence.value;

      // Checar se as informações são validas
      if (
        !valid_inputs(distance, duration, cadence) ||
        !all_positive(distance, duration, cadence)
      ) {
        return alert("Inputs have to be positive numbers!");
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // Se o workout for cycling, criar um objeto cycling
    if (type === "cycling") {
      const elevation = +input_elevation.value;

      // Checar se as informações são validas
      if (
        !valid_inputs(distance, duration, elevation) ||
        !all_positive(distance, duration)
      ) {
        return alert("Inputs have to be positive numbers!");
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Adicionar o novo objeto ao array de workouts
    this.#workouts.push(workout);

    // Mostrar workout no mapa como marcador
    this._render_workout_marker(workout);

    // Mostrar workout na lista
    this._render_workout(workout);

    // Limpando campos do formulário e escondendo-o depois de envia-lo
    this._hide_form();

    // Definindo um storage local para todos os workouts
    this._set_local_storage();
  }

  _render_workout_marker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        // Definindo configurações do popup
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      // Definindo texto do popup
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  // Função responsavel por mostrar workout na lista
  _render_workout(workout) {
    // prettier-ignore
    let html = `
      <li class="workout workout-${workout.type}" data-id="${workout.id}">
        <h2 class="workout-title">${workout.description}</h2>
        <div class="workout-details">
          <span class="workout-icon">${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
          <span class="workout-value">${workout.distance}</span>
          <span class="workout-unit">km</span>
        </div>
        <div class="workout-details">
          <span class="workout-icon">⏱</span>
          <span class="workout-value">${workout.duration}</span>
          <span class="workout-unit">min</span>
        </div>
    `;

    if (workout.type === "running") {
      html += `
          <div class="workout-details">
            <span class="workout-icon">⚡️</span>
            <span class="workout-value">${workout.pace.toFixed(1)}</span>
            <span class="workout-unit">min/km</span>
          </div>
          <div class="workout-details">
            <span class="workout-icon">🦶🏼</span>
            <span class="workout-value">${workout.cadence}</span>
            <span class="workout-unit">spm</span>
          </div>
        </li>
      `;
    } else {
      html += `
          <div class="workout-details">
            <span class="workout-icon">⚡️</span>
            <span class="workout-value">${workout.speed.toFixed(1)}</span>
            <span class="workout-unit">km/h</span>
          </div>
          <div class="workout-details">
            <span class="workout-icon">⛰</span>
            <span class="workout-value">${workout.elevation_gain}</span>
            <span class="workout-unit">m</span>
          </div>
        </li>
      `;
    }

    // Inserindo o html depois do formulário do exercicio
    form.insertAdjacentHTML("afterend", html);
  }

  // Função responsavel por centralizar o mapa no popup baseado no clique do usuario na lista
  _move_to_popup(e) {
    // Variavel definida com base no workout que o usuario selecionar
    const workout_element = e.target.closest(".workout");

    // Clausula de defesa para caso o usuario não selecione o workout
    if (!workout_element) {
      return;
    }

    // Coletando na lista de workouts o workout correto com base no que o usuario selecionou
    const workout = this.#workouts.find(
      (work) => work.id === workout_element.dataset.id
    );

    // Mudando a posição do mapa
    this.#map.setView(workout.coords, this.#map_zoom_level, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // Função que vai armazenar dados do aplicativo em um storage local
  _set_local_storage() {
    // Transformando o objeto workouts em uma string para ser armazenado no local storage
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  // Função que vai usar as informações depositadas no storage local
  _get_local_storage() {
    // Transformando a string do local storage em um objeto para usar no app
    const data = JSON.parse(localStorage.getItem("workouts"));

    // Clausula de defesa para caso não hajam informações no local storage
    if (!data) {
      return;
    }

    // Adicionando as informações do local storage ao aplicativo
    this.#workouts = data;

    // Usando as informações adicionadas ao aplicativo para mostrar os workouts na lista
    this.#workouts.forEach((work) => {
      this._render_workout(work);
    });
  }

  // Função publica para resetar local storage pelo console do navegador
  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}

const app = new App();

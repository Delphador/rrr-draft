export interface Character {
  id: string;
  name: string;
  image: string;
}

export const CHARACTERS: Character[] = [
  { id: 'jake', name: 'Jake', image: '/images/jake.png' },
  { id: 'cyberhawk', name: 'Cyberhawk', image: '/images/cyberhawk.png' },
  { id: 'olaf', name: 'Olaf', image: '/images/olaf.png' },
  { id: 'tarquinn', name: 'Tarquinn', image: '/images/tarquinn.png' },
  { id: 'ivan', name: 'Ivan', image: '/images/ivan.png' },
  { id: 'snake', name: 'Snake', image: '/images/snake.png' },
];
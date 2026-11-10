import { Owner } from "./Owner.tsx";
import { GuestBooking } from "./GuestBooking.tsx";

function CalendarMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="22" height="21" rx="5" />
      <path d="M11 4v6m10-6v6M5 14h22m-16 6h4m4 0h2m-10 4h2" />
    </svg>
  );
}

function Header({
  isBooking,
  isOwner,
}: {
  isBooking: boolean;
  isOwner: boolean;
}) {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <CalendarMark />
        <span>Календарь звонков</span>
      </a>
      <nav aria-label="Основная навигация">
        <a href="/" aria-current={!isBooking && !isOwner ? "page" : undefined}>
          Главная
        </a>
        <a href="/booking" aria-current={isBooking ? "page" : undefined}>
          Запись
        </a>
        <a href="/owner" aria-current={isOwner ? "page" : undefined}>
          Владельцу календаря
        </a>
      </nav>
    </header>
  );
}

function HomePage() {
  return (
    <main className="home-main">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Хорошая встреча начинается здесь</p>
          <h1 id="home-title">Выберите удобное время для встречи</h1>
          <p className="hero-description">
            Встреча с владельцем календаря — в удобное для вас время. Всё
            начинается с простого выбора.
          </p>
          <a className="primary-link" href="/booking">
            Записаться на встречу <span aria-hidden="true">↗</span>
          </a>
          <p className="registration-note">
            <span aria-hidden="true">✓</span> <span>Без регистрации</span>
          </p>
        </div>
        <div className="hero-note">
          <svg
            className="sun-mark"
            viewBox="0 0 180 180"
            fill="none"
            aria-hidden="true"
          >
            <path d="M90 18v40m0 64v40M18 90h40m64 0h40M39 39l28 28m46 46 28 28M39 141l28-28m46-46 28-28M24 62l37 16m58 24 37 16M62 24l16 37m24 58 16 37M24 118l37-16m58-24 37-16M62 156l16-37m24-58 16-37" />
          </svg>
          <p>
            Меньше переписки.
            <br />
            Больше времени
            <br />
            <em>на разговор.</em>
          </p>
          <span className="note-caption">Найдите время для важного</span>
        </div>
      </section>

      <section className="steps-section" aria-labelledby="steps-title">
        <div className="section-heading">
          <h2 id="steps-title">Как будет устроена запись</h2>
          <p>Три простых шага — и можно готовиться к встрече.</p>
        </div>
        <ol className="steps" aria-labelledby="steps-title">
          <li>
            <span className="step-number" aria-hidden="true">
              01
            </span>
            <h3>Выберите тип встречи</h3>
            <p>Найдите подходящий формат общения с владельцем календаря.</p>
          </li>
          <li>
            <span className="step-number" aria-hidden="true">
              02
            </span>
            <h3>Выберите день и время</h3>
            <p>Посмотрите свободное время и выберите удобное для себя.</p>
          </li>
          <li>
            <span className="step-number" aria-hidden="true">
              03
            </span>
            <h3>Укажите имя и email</h3>
            <p>Оставьте свои данные, чтобы завершить запись на встречу.</p>
          </li>
        </ol>
        <p className="coming-soon-note">
          Онлайн-запись скоро появится. Эти шаги — о том, как она будет
          работать.
        </p>
      </section>
    </main>
  );
}

function BookingPage() {
  return (
    <main className="booking-main">
      <h1>Запись на встречу</h1>
      <div className="booking-card">
        <GuestBooking />
        <a className="home-link" href="/">
          <span aria-hidden="true">←</span> На главную
        </a>
      </div>
    </main>
  );
}

export default function App() {
  const isOwner = window.location.pathname === "/owner";
  const isBooking = window.location.pathname === "/booking";

  return (
    <div className="site-shell">
      <Header isBooking={isBooking} isOwner={isOwner} />
      {isOwner ? <Owner /> : isBooking ? <BookingPage /> : <HomePage />}
      <footer className="site-footer">
        <span>Календарь звонков</span>
        <span>Для встреч, которым хочется уделить время.</span>
      </footer>
    </div>
  );
}

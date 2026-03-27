import { useEffect, useState, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Users, BookOpen, GraduationCap, Star } from 'lucide-react';

const stats = [
  { icon: Users, label: 'Total Instructors', value: 50, suffix: '+' },
  { icon: BookOpen, label: 'Total Courses', value: 120, suffix: '+' },
  { icon: GraduationCap, label: 'Total Students', value: 10000, suffix: '+' },
  { icon: Star, label: 'Average Rating', value: 4.8, suffix: '/5', decimal: true },
];

const CountUp = ({ end, decimal, suffix }: { end: number; decimal?: boolean; suffix: string }) => {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (inView && !hasAnimated.current) {
      hasAnimated.current = true;
      const duration = 2000;
      const steps = 60;
      const stepValue = end / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += stepValue;
        if (current >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(current);
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [inView, end]);

  return (
    <span ref={ref} className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground">
      {decimal ? count.toFixed(1) : Math.floor(count).toLocaleString()}{suffix}
    </span>
  );
};

const StatsSection = () => {
  return (
    <section className="bg-primary py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center space-y-2">
              <stat.icon className="h-8 w-8 text-accent-light mx-auto mb-2" />
              <CountUp end={stat.value} decimal={stat.decimal} suffix={stat.suffix} />
              <p className="text-sm text-primary-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
